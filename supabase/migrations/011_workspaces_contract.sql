-- ─────────────────────────────────────────────────────────────────────────────
-- CreatorDesk — Phase 2, stage 3 of 3: workspaces (CONTRACT).
-- Run this ONLY after 010 has been applied AND the app has been running against
-- it long enough that you trust it. This is the point of no return: once
-- creator_id is gone, 010's down script no longer has anything to fall back to.
--
-- Everything the app writes now carries workspace_id (lib/workspace.ts), and
-- nothing reads creator_id any more, so these columns are dead weight that
-- would otherwise drift out of sync with reality the first time a workspace
-- gains a second member.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Preconditions ────────────────────────────────────────────────────────────
-- Refuse to run unless 010 actually enforced isolation. Dropping creator_id
-- while the old policies were still in force would leave tables with no
-- effective policy at all — every row readable by everyone.

do $$
declare unenforced text;
begin
  select string_agg(c.relname, ', ')
    into unenforced
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and c.relname in ('brands','deals','payments','deal_deliverables',
                       'brand_ratings','invoices','invoice_line_items')
     and (c.relrowsecurity = false or c.relforcerowsecurity = false);

  if unenforced is not null then
    raise exception
      'Migration 010 has not been fully applied (RLS not enabled+forced on: %). Run 010 first.', unenforced;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('brands','deals','payments','deal_deliverables',
                        'brand_ratings','invoices','invoice_line_items')
      and qual like '%creator_id%'
  ) then
    raise exception
      'A creator_id-based policy still exists. Re-run 010 before dropping the column it depends on.';
  end if;
end $$;


-- ── Drop the column ──────────────────────────────────────────────────────────
-- `cascade` would silently take any dependent index or constraint with it,
-- which is the point — but nothing outside these tables references creator_id,
-- so the blast radius is known.

alter table brands             drop column if exists creator_id cascade;
alter table deals              drop column if exists creator_id cascade;
alter table deal_deliverables  drop column if exists creator_id cascade;
alter table brand_ratings      drop column if exists creator_id cascade;
alter table invoices           drop column if exists creator_id cascade;
alter table invoice_line_items drop column if exists creator_id cascade;
-- payments never had one; it was scoped through deals until 010.


-- ── Verification ─────────────────────────────────────────────────────────────

do $$
declare leftovers text;
begin
  select string_agg(table_name, ', ')
    into leftovers
    from information_schema.columns
   where table_schema = 'public' and column_name = 'creator_id'
     and table_name in ('brands','deals','payments','deal_deliverables',
                        'brand_ratings','invoices','invoice_line_items');

  if leftovers is not null then
    raise exception 'creator_id still present on: %', leftovers;
  end if;

  raise notice 'Workspace migration complete. Tenancy is now workspace-only.';
end $$;
