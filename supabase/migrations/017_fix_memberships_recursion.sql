-- 017: Break the infinite recursion in the memberships policy.
--
-- Fixes a live, severe bug with two visible symptoms:
--
--   * any read of `memberships`: HTTP 500, 42P17
--     "infinite recursion detected in policy for relation memberships"
--   * every Storage attachments call: HTTP 400
--     "DatabaseInvalidObjectDefinition": the attachments policy's EXISTS
--     subquery pulls memberships into the plan, the recursion fires there
--     too, and storage-api maps 42P17 to that error.
--
-- 010 added this:
--
--   create policy "memberships: owner manages" on memberships for all
--     using (exists (select 1 from memberships owner_row where ...));
--
-- A policy ON memberships that SELECTs FROM memberships re-enters itself.
-- 009's own comment names this trap verbatim, "a policy that queries
-- memberships to decide access to memberships recurses infinitely", and is
-- why `auth_workspace_ids()` was made SECURITY DEFINER. 010 then wrote the
-- recursive form anyway.
--
-- Why it went unnoticed: nothing in the app reads `memberships` directly on a
-- pure read path. It is reached through `getWorkspaceId()`, which every *write*
-- goes through: creating a deal, a brand, an invoice, a deliverable, a rating,
-- a reminder chain, an outbound message. Reads of existing rows kept working
-- because their policies call the SECURITY DEFINER function instead, so the app
-- looked healthy while every insert was failing.
--
-- The fix is the same one 009 used: put the lookup behind a SECURITY DEFINER
-- function so it reads the table without re-triggering the table's policies.
--
-- Safe to re-run.


-- ── The owner lookup, outside RLS ────────────────────────────────────────────
-- Mirrors auth_workspace_ids(), narrowed to workspaces where the caller is the
-- owner. SECURITY DEFINER is load-bearing: it is the whole reason this does not
-- recurse. STABLE lets Postgres hoist it to an InitPlan and evaluate it once
-- per query rather than once per row.

create or replace function auth_owned_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from memberships
  where user_id = auth.uid()
    and status = 'active'
    and role = 'owner'
$$;

revoke all on function auth_owned_workspace_ids() from public;
grant execute on function auth_owned_workspace_ids() to authenticated;


-- ── Membership writes ────────────────────────────────────────────────────────
-- Split per command rather than `for all`, on purpose.
--
-- 009 already installed a SELECT policy ("memberships: own or same workspace").
-- A `for all` policy stacks a second permissive policy onto every read, so both
-- get evaluated and the more expensive one is paid for on every query. Reads
-- are left entirely to 009's policy; this only governs writes.
--
-- A brand-new user owns nothing yet, so none of these would let them insert
-- their own first membership. They never need to: handle_new_user() creates it
-- as SECURITY DEFINER owned by postgres, and memberships is deliberately not
-- FORCE'd (see 010), so the owner bypasses RLS there.

drop policy if exists "memberships: owner manages" on memberships;
drop policy if exists "memberships: owner inserts" on memberships;
drop policy if exists "memberships: owner updates" on memberships;
drop policy if exists "memberships: owner deletes" on memberships;

create policy "memberships: owner inserts"
  on memberships for insert to authenticated
  with check (workspace_id in (select auth_owned_workspace_ids()));

create policy "memberships: owner updates"
  on memberships for update to authenticated
  using (workspace_id in (select auth_owned_workspace_ids()))
  with check (workspace_id in (select auth_owned_workspace_ids()));

create policy "memberships: owner deletes"
  on memberships for delete to authenticated
  using (workspace_id in (select auth_owned_workspace_ids()));


-- ── Verification ─────────────────────────────────────────────────────────────
-- Asserts no policy on memberships still reads memberships in its own body.
-- Checking the rendered expressions is the point: "a policy exists" was true
-- of the broken version too.

do $$
declare
  offending text;
begin
  select string_agg(p.polname, ', ')
    into offending
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'memberships'
     and (
       -- ilike, not like: pg_get_expr deparses keywords uppercase ("FROM
       -- memberships"), so a case-sensitive match would let the broken
       -- policy sail through the very check meant to catch it.
       coalesce(pg_get_expr(p.polqual, p.polrelid), '') ilike '%from memberships%'
       or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ilike '%from memberships%'
     );

  if offending is not null then
    raise exception
      '017: these memberships policies still self-reference and will recurse: %',
      offending;
  end if;

  if to_regprocedure('auth_owned_workspace_ids()') is null then
    raise exception '017: auth_owned_workspace_ids() was not created';
  end if;

  raise notice '017 ok: memberships policies no longer self-reference';
end $$;


-- ── Down ─────────────────────────────────────────────────────────────────────
-- Restores 010's recursive policy. Only useful for reproducing the bug.
--
-- drop policy if exists "memberships: owner inserts" on memberships;
-- drop policy if exists "memberships: owner updates" on memberships;
-- drop policy if exists "memberships: owner deletes" on memberships;
-- drop function if exists auth_owned_workspace_ids();
-- create policy "memberships: owner manages"
--   on memberships for all
--   using (exists (
--     select 1 from memberships owner_row
--     where owner_row.workspace_id = memberships.workspace_id
--       and owner_row.user_id = auth.uid()
--       and owner_row.role = 'owner'
--       and owner_row.status = 'active'
--   ))
--   with check (exists (
--     select 1 from memberships owner_row
--     where owner_row.workspace_id = memberships.workspace_id
--       and owner_row.user_id = auth.uid()
--       and owner_row.role = 'owner'
--       and owner_row.status = 'active'
--   ));
