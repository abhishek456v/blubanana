-- 025: Make "Rates and commercials" a real boundary, not a UI convention.
--
-- 024 shipped six of the seven per-area switches as database rules and left
-- the seventh as app-level masking, because RLS filters rows and `rate` is a
-- column. A manager with deals access but not rates access was sent the rate
-- and shown a blank. Anyone willing to call the API instead of opening the app
-- read the real number.
--
-- ── Why not the obvious fixes ────────────────────────────────────────────────
--
-- Column GRANTs are per-role, and every signed-in user is the same role
-- (`authenticated`), so they cannot distinguish two managers. RLS is per-row
-- and cannot mask a column. Neither mechanism alone can express "this row, but
-- not this field of it, for this person".
--
-- What can: a view that masks the column with a CASE over the same per-area
-- function the row policies use, combined with revoking the underlying columns
-- so the view is the only way to reach them.
--
-- ── The shape ───────────────────────────────────────────────────────────────
--
--   * SELECT on the money columns is revoked from every client role. Nobody
--     reads deals.rate directly any more, including the creator.
--   * `deals_secure` and `deal_deliverables_secure` expose every column, with
--     the money ones wrapped in a CASE that returns NULL unless the caller has
--     `can_see_rates` in that workspace.
--   * The views run with the view owner's privileges (the default — NOT
--     security_invoker), which is what lets them read columns the caller
--     cannot. That makes each view's own WHERE clause the authoritative row
--     filter, so it repeats the tenancy rule rather than leaning on the base
--     table's RLS being reached. Correct whether or not it is.
--   * security_barrier stops a user-supplied function in the outer query from
--     seeing rows before that WHERE has been applied.
--
-- Writes are untouched: INSERT and UPDATE still go to the base table, still
-- under RLS, and writing a rate reveals nothing. Only reading does.
--
-- ── Staying correct ─────────────────────────────────────────────────────────
--
-- The views are built by reading the live column list rather than by listing
-- columns here, so adding a column to `deals` cannot silently leave it out of
-- the view. Any later migration that adds one should end with:
--
--   select rebuild_secure_deal_views();
--
-- Safe to re-run.


-- ── 1. The columns that count as commercial ─────────────────────────────────
-- Kept in one function so the list has a single home. `creator_follower_count_
-- at_time` is deliberately absent: it is a follower snapshot, not a price, and
-- rate-per-follower benchmarking needs it alongside a rate the caller can
-- already see.

create or replace function secure_deal_masked_columns(tbl text)
returns text[]
language sql
immutable
as $$
  select case tbl
    when 'deals' then array['rate', 'ad_rights_fee', 'rate_original', 'fx_rate']
    when 'deal_deliverables' then array['rate']
    else array[]::text[]
  end
$$;


-- ── 2. Build the views from the live column list ────────────────────────────
-- Every column is selected by name. The masked ones become
--   case when <caller has rates here> then col end as col
-- which preserves the column's type and returns NULL rather than an error or a
-- zero. NULL is the honest answer: zero would be summed into a total and quietly
-- understate it.

create or replace function rebuild_secure_deal_views()
returns void
language plpgsql
as $$
declare
  spec   text[] := array['deals', 'deal_deliverables'];
  tbl    text;
  masked text[];
  cols   text;
begin
  foreach tbl in array spec loop
    masked := secure_deal_masked_columns(tbl);

    select string_agg(
             case when c.column_name = any (masked)
               then format(
                 'case when d.workspace_id in '
                 || '(select auth_workspace_ids_allowing(%L)) then d.%I end as %I',
                 'rates', c.column_name, c.column_name)
               else format('d.%I', c.column_name)
             end,
             ', ' order by c.ordinal_position)
      into cols
      from information_schema.columns c
     where c.table_schema = 'public' and c.table_name = tbl;

    if cols is null then
      raise exception 'Table % has no columns, or does not exist', tbl;
    end if;

    -- The row filter. Deliberately not delegated to the base table's RLS:
    -- a definer view may or may not have that applied depending on whether the
    -- view owner bypasses it, and a boundary should not depend on which.
    execute format(
      'create or replace view %I with (security_barrier = true) as '
      || 'select %s from %I d '
      || 'where d.workspace_id in (select auth_workspace_ids_allowing(%L))',
      tbl || '_secure', cols, tbl, 'deals'
    );

    execute format('revoke all on %I from public, anon', tbl || '_secure');
    execute format('grant select on %I to authenticated', tbl || '_secure');
  end loop;
end $$;

select rebuild_secure_deal_views();


-- ── 3. Close the direct path ────────────────────────────────────────────────
-- Revoked from PUBLIC as well as the two client roles: a privilege held via
-- PUBLIC would survive revoking it from `authenticated` and quietly keep the
-- old path open.
--
-- service_role is untouched on purpose. The edge functions read across every
-- workspace with it, and it already bypasses RLS — narrowing it here would
-- break reminders without adding a boundary that RLS does not already concede.

do $$
declare
  tbl text;
  col text;
begin
  foreach tbl in array array['deals', 'deal_deliverables'] loop
    foreach col in array secure_deal_masked_columns(tbl) loop
      execute format('revoke select (%I) on %I from public, anon, authenticated', col, tbl);
    end loop;
  end loop;
end $$;


-- ── 4. Verification ─────────────────────────────────────────────────────────
-- Asserts the property, not the paperwork: that no client role can select the
-- masked columns, and that the views exist and expose them.

do $$
declare
  leaked text;
  tbl    text;
  col    text;
begin
  select string_agg(format('%s.%s to %s', table_name, column_name, grantee), ', ')
    into leaked
    from information_schema.column_privileges
   where table_schema = 'public'
     and privilege_type = 'SELECT'
     and grantee in ('authenticated', 'anon', 'PUBLIC')
     and (
       (table_name = 'deals' and column_name = any (secure_deal_masked_columns('deals')))
       or (table_name = 'deal_deliverables'
           and column_name = any (secure_deal_masked_columns('deal_deliverables')))
     );

  if leaked is not null then
    raise exception 'Commercial columns are still directly readable: %', leaked;
  end if;

  foreach tbl in array array['deals', 'deal_deliverables'] loop
    if to_regclass('public.' || tbl || '_secure') is null then
      raise exception '%_secure was not created', tbl;
    end if;

    foreach col in array secure_deal_masked_columns(tbl) loop
      if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = tbl || '_secure'
          and column_name = col
      ) then
        raise exception '%_secure is missing the % column', tbl, col;
      end if;
    end loop;
  end loop;

  raise notice 'OK. Rates are masked in the database, not just on screen.';
end $$;
