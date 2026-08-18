-- 033: The Instagram connection, and the nightly sync that feeds cost per view.
--
-- §8.11 wants CPV on the rate card, and §12 lists the Meta credentials as the
-- blocker. This builds everything that does not need them, so the day the app
-- id and secret are set the feature starts working with no code change:
--
--   * `lib/social/index.ts` picks the real provider when
--     EXPO_PUBLIC_META_APP_ID is present, and the mock when it is not.
--   * `social-oauth` handles the redirect and stores the token.
--   * `social-sync` writes a daily reach snapshot and, more importantly,
--     writes view counts back onto `deal_deliverables` — which is what makes
--     CPV computable at all. No creator is going to type a view count in for
--     every post she has ever published.
--
-- Safe to re-run.


-- ── 1. OAuth state ──────────────────────────────────────────────────────────
-- The callback arrives from Meta in a browser with no session, so the `state`
-- nonce is the only thing tying it to a workspace. The app inserts a row before
-- opening the dialog; the callback deletes it on read, which makes it
-- single-use. Without this, anyone could hand us an authorisation code and have
-- the resulting account land in someone else's workspace.

create table if not exists oauth_states (
  state        text        primary key,
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  platform     text        not null check (platform in ('instagram', 'youtube')),
  -- Short by design. A state that outlives the browser tab it was made for is
  -- a replay window, and the flow takes under a minute.
  expires_at   timestamptz not null default now() + interval '10 minutes',
  created_at   timestamptz not null default now()
);

create index if not exists oauth_states_expiry_idx on oauth_states (expires_at);

alter table oauth_states enable row level security;

-- The caller may only create a state for a workspace they belong to, and may
-- never read one back: a readable nonce is not a nonce. The callback consumes
-- it with the service role.
drop policy if exists "oauth_states: members create" on oauth_states;
create policy "oauth_states: members create"
  on oauth_states for insert to authenticated
  with check (workspace_id in (select auth_workspace_ids()));


-- ── 2. Housekeeping ─────────────────────────────────────────────────────────
-- Expired states are dead weight and a nonce table that only grows is a slow
-- leak of workspace ids.

create or replace function purge_expired_oauth_states()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from oauth_states where expires_at < now();
  get diagnostics removed = row_count;
  return removed;
end $$;

revoke all on function purge_expired_oauth_states() from public;


-- ── 3. The nightly sync ─────────────────────────────────────────────────────
-- 03:00 UTC is 08:30 IST — after Instagram's own figures have settled for the
-- previous day, and before the creator is likely to open the app and wonder
-- why yesterday is missing.
--
-- Authenticated with the same CRON_SECRET the reminder sender uses. The
-- function refuses a full sync without it, so a signed-in user cannot trigger
-- a pass across every workspace.

-- The secret is not typed here and is not in Vault: it was set with
-- `supabase secrets set`, which the database cannot read. It is, however,
-- already sitting inside the reminder job's own command, put there when 022
-- was set up. Lifting it from there keeps this migration free of placeholders
-- — the trap that broke two earlier setups — and guarantees both jobs
-- authenticate with the identical string.

do $$
declare
  secret text;
begin
  select (regexp_match(command, '''x-cron-secret'', ''([^'']+)'''))[1]
    into secret
    from cron.job
   where jobname = 'send-due-reminders';

  if secret is null or length(secret) < 8 then
    raise exception
      'Could not read CRON_SECRET from the send-due-reminders job. Set that job up first (README, Push notifications).';
  end if;

  perform cron.unschedule('social-sync-nightly')
    where exists (select 1 from cron.job where jobname = 'social-sync-nightly');

  perform cron.schedule(
    'social-sync-nightly',
    '0 3 * * *',
    format(
      $job$
      select net.http_post(
        url     := 'https://bbdvgeavtxfxykhiafbp.supabase.co/functions/v1/social-sync',
        headers := jsonb_build_object('x-cron-secret', %L, 'Content-Type', 'application/json'),
        body    := jsonb_build_object('action', 'cron')
      );
      $job$, secret)
  );
end $$;

select cron.unschedule('purge-oauth-states')
 where exists (select 1 from cron.job where jobname = 'purge-oauth-states');

select cron.schedule('purge-oauth-states', '30 3 * * *', $$ select purge_expired_oauth_states(); $$);


-- ── 4. Verification ─────────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.oauth_states') is null then
    raise exception 'oauth_states was not created';
  end if;

  -- A readable nonce is not a nonce. There must be no SELECT policy on it.
  if exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'oauth_states'
       and cmd in ('SELECT', 'ALL')
  ) then
    raise exception 'oauth_states has a readable policy; the nonce must never be selectable';
  end if;

  if not exists (select 1 from cron.job where jobname = 'social-sync-nightly') then
    raise exception 'The nightly social sync job was not created';
  end if;

  raise notice 'OK. Instagram can connect, and the nightly sync is scheduled.';
end $$;
