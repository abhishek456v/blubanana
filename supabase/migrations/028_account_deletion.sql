-- 028: Make deleting an account actually delete the account.
--
-- §8.18 calls this a legal obligation rather than a courtesy: CreatorDesk
-- stores brand contacts' names and phone numbers, which is third-party
-- personal data, and that makes this business a Data Fiduciary under the
-- DPDP Act 2023. A "delete" that leaves rows behind is not compliance.
--
-- Deleting the auth user alone does not do it. Two gaps:
--
--   1. `workspaces` has no owner column and nothing references profiles from
--      it, so the cascade from auth.users stops at `memberships`. The
--      workspace row survives, and so does everything hanging off it that was
--      not created by the deleted user. The edge function therefore deletes
--      the owned workspaces first — every business table carries
--      `workspace_id ... on delete cascade`, so that is what actually clears
--      the data.
--
--   2. Every business table also carries `creator_id references profiles on
--      delete cascade`. For a manager who worked in someone else's workspace,
--      that cascade would delete *the creator's* deals — rows that are not the
--      departing manager's to take with them. This function reassigns them to
--      the workspace owner first.
--
-- Safe to re-run.


-- ── Reassign what belongs to someone else ───────────────────────────────────
-- Driven off information_schema rather than a hardcoded list, so a business
-- table added later is covered without anyone remembering this file exists.
-- The condition is deliberately narrow: only rows in workspaces the departing
-- user does NOT own. Rows in their own workspaces are theirs, and go.

create or replace function reassign_creator_rows_for_deletion(target uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  tbl     text;
  moved   integer := 0;
  batch   integer;
begin
  if target is null then
    return 0;
  end if;

  for tbl in
    select c.table_name
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.column_name = 'creator_id'
       and exists (
         select 1 from information_schema.columns w
          where w.table_schema = 'public'
            and w.table_name = c.table_name
            and w.column_name = 'workspace_id'
       )
       -- Base tables only. A view with these columns is not updatable here and
       -- would abort the whole function.
       and exists (
         select 1 from information_schema.tables t
          where t.table_schema = 'public'
            and t.table_name = c.table_name
            and t.table_type = 'BASE TABLE'
       )
  loop
    execute format(
      'update %I t
          set creator_id = o.user_id
         from memberships o
        where t.creator_id = $1
          and o.workspace_id = t.workspace_id
          and o.role = ''owner''
          and o.status = ''active''
          and o.user_id <> $1
          and t.workspace_id not in (
                select m.workspace_id from memberships m
                 where m.user_id = $1 and m.role = ''owner''
              )', tbl
    ) using target;

    get diagnostics batch = row_count;
    moved := moved + batch;
  end loop;

  return moved;
end $$;

revoke all on function reassign_creator_rows_for_deletion(uuid) from public;
-- Only the service role calls this, from the delete-account edge function.
-- `authenticated` is deliberately not granted: a signed-in user has no reason
-- to reassign anyone's rows, including their own.
grant execute on function reassign_creator_rows_for_deletion(uuid) to service_role;


-- ── Verification ────────────────────────────────────────────────────────────

do $$
declare
  covered text;
begin
  select string_agg(c.table_name, ', ' order by c.table_name) into covered
    from information_schema.columns c
   where c.table_schema = 'public'
     and c.column_name = 'creator_id'
     and exists (
       select 1 from information_schema.columns w
        where w.table_schema = 'public' and w.table_name = c.table_name
          and w.column_name = 'workspace_id'
     );

  if covered is null then
    raise exception 'No table carries both creator_id and workspace_id, which cannot be right';
  end if;

  -- A no-op call proves the dynamic SQL parses against every one of them,
  -- rather than discovering a bad table name during a real deletion.
  perform reassign_creator_rows_for_deletion('00000000-0000-0000-0000-000000000000');

  raise notice 'OK. Deletion reassignment covers: %', covered;
end $$;
