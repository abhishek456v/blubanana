-- 028: Account deletion needs no row reassignment. Recording why.
--
-- This migration originally created `reassign_creator_rows_for_deletion()`, on
-- the reasoning that every business table carries
--
--   creator_id uuid not null references profiles(id) on delete cascade
--
-- and that deleting a *manager's* account would therefore cascade away the
-- creator's deals — rows in a workspace the manager merely worked in. That
-- would have been a serious bug, and the function reassigned those rows to the
-- workspace owner before deletion.
--
-- It was reasoning from 001, 006, 007 and 008, which do declare exactly that.
-- What it missed is that **011 dropped every one of those columns** — the
-- contract half of the expand→contract migration 009 describes in its own
-- header. There is no `creator_id` anywhere any more. Attribution is
-- `workspace_id` and nothing else.
--
-- So the case cannot arise, and the migration's own verification caught it:
-- "No table carries both creator_id and workspace_id, which cannot be right."
-- It was right.
--
-- ── What deletion actually relies on ────────────────────────────────────────
--
-- Left here because the next person to look at deletion will have the same
-- idea, and this saves them the same detour.
--
--   * Every one of the 18 business tables is `workspace_id references
--     workspaces(id) on delete cascade`. Deleting the workspace is what clears
--     the data — and it is the step the auth cascade does NOT reach, because
--     `workspaces` has no column pointing back at a profile. That gap is real
--     and is why the edge function deletes owned workspaces explicitly.
--
--   * The surviving references to `profiles` are:
--       memberships.user_id          cascade  — their own membership, correct
--       workspace_invites.invited_by cascade  — invites they sent, in a
--                                               workspace being deleted anyway
--       outbound_messages.approved_by  set null — message history survives
--       audit_logs.actor_user_id       set null — audit trail survives
--
--     Two cascades, both of things that are genuinely the departing user's,
--     and two set-nulls that deliberately preserve a record while forgetting
--     who. Nothing belonging to another creator hangs off a profile.
--
-- Safe to re-run.


-- Removes the function if an earlier attempt at this migration left one behind.
drop function if exists reassign_creator_rows_for_deletion(uuid);


-- ── Verification ────────────────────────────────────────────────────────────
-- Asserts the premise this migration rests on, so that if a `creator_id` is
-- ever reintroduced, deletion is revisited rather than quietly going wrong.

do $$
declare
  resurrected text;
  uncascaded  text;
begin
  select string_agg(table_name, ', ' order by table_name) into resurrected
    from information_schema.columns
   where table_schema = 'public' and column_name = 'creator_id';

  if resurrected is not null then
    raise exception
      'creator_id is back on: %. Deleting a manager would now cascade away another creator''s rows — revisit the delete-account function.',
      resurrected;
  end if;

  -- Every workspace-scoped table must cascade, or deleting the workspace
  -- leaves rows behind and the deletion is incomplete.
  select string_agg(c.conrelid::regclass::text, ', ') into uncascaded
    from pg_constraint c
   where c.contype = 'f'
     and c.confrelid = 'workspaces'::regclass
     and c.confdeltype <> 'c';

  if uncascaded is not null then
    raise exception 'These tables do not cascade from workspaces: %', uncascaded;
  end if;

  raise notice 'OK. No creator_id survives, and every workspace reference cascades.';
end $$;
