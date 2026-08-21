-- Count rows without fetching them.
--
-- The people and funnel screens each need the same three numbers per
-- workspace: how many brands, deals and invoices. PostgREST cannot group, so
-- both were fetching every row of all three tables and counting them in
-- memory.
--
-- That works, and it is wrong in two ways that both get worse quietly. It
-- moves the whole deals table across the network to produce five integers.
-- And it depends on the server returning every row: PostgREST can be
-- configured with a ceiling, and if one is ever set, the counts do not fail,
-- they simply become too low. A number that is silently wrong is worse than a
-- screen that does not load, because nobody checks a number that looks
-- plausible.
--
-- Security definer, and executable by nobody except the server. It reads
-- across every workspace, which is precisely what row level security exists to
-- prevent, so it is available only to the role the admin edge function runs
-- as. `authenticated` cannot call it, and the search path is pinned so a
-- caller cannot put their own `deals` in front of the real one.

create or replace function admin_workspace_counts()
returns table (
  workspace_id uuid,
  brands       bigint,
  deals        bigint,
  invoices     bigint
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select
    w.id,
    (select count(*) from brands   b where b.workspace_id = w.id),
    (select count(*) from deals    d where d.workspace_id = w.id),
    (select count(*) from invoices i where i.workspace_id = w.id)
  from workspaces w
$$;

revoke all on function admin_workspace_counts() from public, anon, authenticated;
grant execute on function admin_workspace_counts() to service_role;

comment on function admin_workspace_counts() is
  'Per-workspace row counts for the admin dashboard. Service role only: it reads across every workspace.';
