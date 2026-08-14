-- 016 — Schema-qualify the attachments storage policy (hardening only).
--
-- ── Corrected diagnosis ──────────────────────────────────────────────────────
--
-- The first version of this file claimed the live storage failure
--
--   HTTP 400  DatabaseInvalidObjectDefinition
--   "The database schema is invalid or incompatible."
--
-- was caused by the policy referencing `memberships` unqualified while
-- storage-api's search_path lacks `public`. That theory was wrong, and its
-- verification block (checking pg_get_expr output for 'public.memberships')
-- could never pass: Postgres stores a policy as a parse tree bound to table
-- OIDs, so `memberships` and `public.memberships` produce the identical stored
-- policy, and pg_get_expr deparses it back *without* the schema whenever
-- `public` is visible to the reading session — as it always is in the SQL
-- editor. The check was asserting something Postgres does not store.
--
-- The real cause of the storage failure is migration 017's bug: this policy's
-- EXISTS subquery pulls `memberships` into the query plan, memberships' own
-- RLS expands, and 010's self-referencing "owner manages" policy recurses —
-- 42P17 at planning time. storage-api maps 42P17 to
-- DatabaseInvalidObjectDefinition. PostgREST surfaces the same 42P17 as the
-- HTTP 500 on /rest/v1/memberships. One bug, two symptoms; **017 fixes both.**
--
-- ── What this migration still does ───────────────────────────────────────────
--
-- Recreates the policy with the schema spelled out. Behaviourally a no-op
-- (same OID either way), but it makes the policy re-creatable verbatim from a
-- session whose search_path lacks `public` — where the unqualified form would
-- fail to parse at CREATE time. Cheap insurance, nothing more. Attachments
-- stay broken until 017 runs, whichever order these two are applied in.
--
-- Safe to re-run.

drop policy if exists "attachments: own folder only" on storage.objects;
drop policy if exists "attachments: workspace members" on storage.objects;

create policy "attachments: workspace members"
  on storage.objects for all
  using (
    bucket_id = 'attachments'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.status = 'active'
        -- Compared as text, not cast to uuid: an object whose first path
        -- segment is not a uuid would make the cast throw, and a storage
        -- policy that errors is a storage policy that denies everything.
        and m.workspace_id::text = (storage.foldername(name))[1]
    )
  )
  with check (
    bucket_id = 'attachments'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.status = 'active'
        and m.workspace_id::text = (storage.foldername(name))[1]
    )
  );


-- ── Verification ─────────────────────────────────────────────────────────────
-- Asserts what is actually knowable: the policy exists, still gates on the
-- memberships table, and still compares the folder segment. (Schema
-- qualification is not stored, so it cannot be verified — see above.)

do $$
declare
  policy_body text;
begin
  select pg_get_expr(p.polqual, p.polrelid)
    into policy_body
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'storage'
     and c.relname = 'objects'
     and p.polname = 'attachments: workspace members';

  if policy_body is null then
    raise exception '016: the attachments policy is missing';
  end if;

  if policy_body not ilike '%from memberships%' then
    raise exception '016: the policy no longer checks memberships: %', policy_body;
  end if;

  if policy_body not ilike '%foldername%' then
    raise exception '016: the policy no longer checks the folder segment: %', policy_body;
  end if;

  raise notice '016 ok — attachments policy recreated (hardening; the live fix is 017)';
end $$;


-- ── Down ─────────────────────────────────────────────────────────────────────
-- Not needed: behaviourally identical to 010's version of the policy.
