-- ─────────────────────────────────────────────────────────────────────────────
-- Blubanana: connected social accounts and the reach time series.
-- Run this once in the Supabase dashboard SQL editor, after 012.
--
-- Each creator connects THEIR OWN Instagram / YouTube. The app reads their
-- follower count and engagement so rate benchmarking has real numbers instead
-- of a figure typed in by hand months ago. Nothing is ever posted on their
-- behalf, and no other creator's data is ever touched.
--
-- Safe to re-run.
--
--
-- WHY TOKENS ARE NOT READABLE BY THE APP
--
-- An OAuth token is the single most dangerous value in this database: it grants
-- access to a creator's real Instagram account. RLS alone is not enough here:
-- it is row-level, so a policy that lets a creator read *their own* row also
-- lets the client read the token in it, where it can end up in a log, a crash
-- report, or a redux dump.
--
-- So the token columns are protected at the COLUMN level: `authenticated` is
-- granted select on every column except the two token columns. The client can
-- see that an account is connected, its handle, and when it last synced, and
-- physically cannot read the credential. Only service_role (Edge Functions) can.
--
-- That means token exchange and refresh must happen in an Edge Function, never
-- in the app. That is the correct place for it regardless: an OAuth client
-- secret cannot ship inside a mobile binary.
-- ─────────────────────────────────────────────────────────────────────────────


do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'workspaces'
  ) then
    raise exception 'Migration 009 has not been applied. Run 009_workspaces_expand.sql first.';
  end if;
end $$;


-- ── Connected accounts ───────────────────────────────────────────────────────

create table if not exists social_accounts (
  id                  uuid        primary key default gen_random_uuid(),
  workspace_id        uuid        not null references workspaces(id) on delete cascade,

  platform            text        not null check (platform in ('instagram', 'youtube')),
  handle              text        not null,
  -- The platform's own id for the account. Handles change; this does not, so
  -- it is what stat history stays attached to when a creator renames.
  external_account_id text,

  -- Server-only. See the header; `authenticated` has no select grant on these.
  access_token        text,
  refresh_token       text,
  token_expires_at    timestamptz,
  scopes              text[]      not null default '{}',

  status              text        not null default 'active'
                        check (status in ('active', 'expired', 'revoked', 'error')),
  last_synced_at      timestamptz,
  -- Surfaced in the UI as "reconnect", never as a raw error. Token expiry is a
  -- normal state, not a failure.
  last_error          text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (workspace_id, platform, handle)
);

create index if not exists social_accounts_workspace_idx
  on social_accounts (workspace_id, platform);

-- Drives the "which accounts are due a refresh?" query the sync job will run.
create index if not exists social_accounts_sync_idx
  on social_accounts (last_synced_at) where status = 'active';

alter table social_accounts enable row level security;
alter table social_accounts force  row level security;

drop policy if exists "social_accounts: workspace members" on social_accounts;
create policy "social_accounts: workspace members"
  on social_accounts for all
  using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

-- Column-level protection for the credentials. Revoke the blanket grant, then
-- hand back every column except the tokens. A `select *` from the client will
-- now fail loudly rather than quietly returning a token, which is the right
-- failure mode, and why lib/social reads an explicit column list.
revoke select on social_accounts from authenticated;
grant select (
  id, workspace_id, platform, handle, external_account_id,
  token_expires_at, scopes, status, last_synced_at, last_error,
  created_at, updated_at
) on social_accounts to authenticated;

-- Insert/update/delete stay available so the app can disconnect an account and
-- record a manual handle. Writing a token from the client is pointless anyway:
-- the OAuth exchange needs a client secret, which only the server has.
grant insert, update, delete on social_accounts to authenticated;


-- ── Reach over time ──────────────────────────────────────────────────────────
-- One row per account per day. This time series is what makes "your engagement
-- is up 22% and your rate hasn't moved" computable: without a follower figure
-- dated to each deal, that sentence cannot be written.

create table if not exists creator_stat_snapshots (
  id                uuid        primary key default gen_random_uuid(),
  workspace_id      uuid        not null references workspaces(id) on delete cascade,
  -- Kept if the account is disconnected: the history is the creator's, not the
  -- connection's, and deleting it would silently rewrite past benchmarks.
  social_account_id uuid        references social_accounts(id) on delete set null,

  platform          text        not null check (platform in ('instagram', 'youtube')),
  captured_on       date        not null default current_date,

  followers         integer,
  following         integer,
  posts_count       integer,
  avg_views         integer,
  avg_likes         integer,
  engagement_rate   numeric(6,3),   -- percentage, e.g. 4.213

  source            text        not null default 'api' check (source in ('api', 'manual')),
  created_at        timestamptz not null default now(),

  -- One snapshot per account per day. A sync job that runs twice updates the
  -- day's row instead of growing the table without bound.
  unique (workspace_id, platform, captured_on, social_account_id)
);

create index if not exists creator_stat_snapshots_series_idx
  on creator_stat_snapshots (workspace_id, platform, captured_on desc);

alter table creator_stat_snapshots enable row level security;
alter table creator_stat_snapshots force  row level security;

drop policy if exists "creator_stat_snapshots: workspace members" on creator_stat_snapshots;
create policy "creator_stat_snapshots: workspace members"
  on creator_stat_snapshots for all
  using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));


-- ── updated_at ───────────────────────────────────────────────────────────────

drop trigger if exists social_accounts_updated_at on social_accounts;
create trigger social_accounts_updated_at
  before update on social_accounts
  for each row execute function set_updated_at();


do $$
begin
  raise notice 'Social accounts ready. Token columns are not readable by the app role.';
end $$;
