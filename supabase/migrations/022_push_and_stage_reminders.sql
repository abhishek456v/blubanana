-- ═════════════════════════════════════════════════════════════════════════════
-- 022: real push notifications, and reminders keyed to stages
--
-- Run AFTER 021, and deploy the matching app build at the same time.
--
-- WHY
--
-- Reminders were scheduled on the device. That is why they die when the app is
-- not opened for a week, and why they never worked on the web at all: nothing
-- was watching the clock except the phone that happened to have the app in
-- memory. The schedule moves to the server, which wakes on a cron and pushes.
--
-- Reminders were also keyed to a fixed stage enum (script_due | shoot |
-- editing | publish). Migration 019 made stages user-defined, so a creator who
-- renamed "Shoot" to "Studio day" or added a client-review round had stages no
-- reminder could point at. Reminders now reference deal_stages.id.
--
-- That was the last reader of the four date columns on deals, and the brand
-- contact columns lost their last reader when brand_contacts shipped, so both
-- sets are dropped here. This is the CONTRACT half of the pair that started
-- with 019.
--
-- Paste into the Supabase dashboard SQL editor. One transaction.
-- ═════════════════════════════════════════════════════════════════════════════


-- ── 1. Push tokens ───────────────────────────────────────────────────────────
-- One row per device per user. The token is what Expo's push service addresses,
-- and it changes on reinstall, so it is upserted on every sign-in rather than
-- written once.

create table if not exists push_tokens (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  token        text        not null unique,
  platform     text        not null check (platform in ('ios', 'android', 'web')),
  -- Refreshed on every sign-in, so a device that stops appearing can be
  -- retired rather than pushed to forever.
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists push_tokens_workspace_idx on push_tokens (workspace_id);
create index if not exists push_tokens_user_idx      on push_tokens (user_id);

alter table push_tokens enable row level security;
alter table push_tokens force  row level security;

-- Scoped to the user, not the workspace: a manager invited into a creator's
-- workspace must not be able to read or delete the creator's device tokens.
drop policy if exists "push_tokens: own devices" on push_tokens;
create policy "push_tokens: own devices" on push_tokens for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists push_tokens_updated_at on push_tokens;
create trigger push_tokens_updated_at
  before update on push_tokens
  for each row execute function set_updated_at();


-- ── 2. Reminders point at a stage row ────────────────────────────────────────

alter table reminders
  add column if not exists deal_stage_id uuid references deal_stages(id) on delete cascade;

create index if not exists reminders_stage_idx on reminders (deal_stage_id);

-- Backfill from the old enum by position. The four legacy stage names map onto
-- the four default stages a deal was created with, which is exactly what 019's
-- backfill produced.
update reminders r
set deal_stage_id = s.id
from deal_stages s
where r.deal_stage_id is null
  and r.deal_id = s.deal_id
  and s.sort_order = case r.stage
                       when 'script_due' then 0
                       when 'shoot'      then 1
                       when 'editing'    then 2
                       when 'publish'    then 3
                     end;

-- `stage` stays, holding the stage's NAME for display, so a sent reminder
-- still reads correctly after the stage it referred to is renamed or deleted.
-- Dropping it would make historical reminders unreadable.
comment on column reminders.stage is
  'Display name of the stage at the time the reminder was created. Historical; deal_stage_id is the live reference.';


-- ── 3. Server-side scheduling needs to find due work fast ────────────────────
-- The cron job runs every few minutes and asks the same question every time:
-- what is scheduled, and due? A partial index keeps that to an index scan even
-- once the table holds every reminder ever sent.

create index if not exists reminders_due_idx
  on reminders (scheduled_for)
  where status = 'scheduled';


-- ── 4. Contract: drop what nothing reads any more ────────────────────────────
-- The four date columns lost their last reader when reminders moved to stages.
-- The brand contact columns lost theirs when brand_contacts shipped.
--
-- Guarded: if the running app still writes them, this migration has been run
-- ahead of its build and should stop rather than break it.

do $$
begin
  if exists (
    select 1 from deals d
    where not exists (select 1 from deal_stages s where s.deal_id = d.id)
  ) then
    raise exception
      'Some deals have no stages; dropping the date columns would lose their dates.';
  end if;
end $$;

alter table deals drop column if exists script_due_date;
alter table deals drop column if exists shoot_date;
alter table deals drop column if exists edit_done_date;
alter table deals drop column if exists publish_date;

alter table brands drop column if exists contact_person;
alter table brands drop column if exists contact_phone;
alter table brands drop column if exists contact_email;


-- ── 5. Verification ──────────────────────────────────────────────────────────

do $$
declare
  unlinked bigint;
  leftover text;
begin
  select count(*) into unlinked
  from reminders
  where type = 'workflow' and status = 'scheduled' and deal_stage_id is null;

  if unlinked > 0 then
    raise exception
      '% scheduled workflow reminder(s) are not linked to a stage.', unlinked;
  end if;

  select string_agg(column_name, ', ') into leftover
  from information_schema.columns
  where table_schema = 'public'
    and ((table_name = 'deals'  and column_name in
          ('script_due_date','shoot_date','edit_done_date','publish_date'))
      or (table_name = 'brands' and column_name in
          ('contact_person','contact_phone','contact_email')));

  if leftover is not null then
    raise exception 'Columns still present after the drop: %', leftover;
  end if;

  raise notice 'OK. Reminders keyed to stages, push_tokens ready, legacy columns dropped.';
end $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- DOWN SCRIPT
--
-- NOT a full rollback. Dropping the four date columns and the three contact
-- columns discards their values; re-adding them gives you empty columns.
--
-- The data is not lost: the dates live in deal_stages and the contacts in
-- brand_contacts, both richer than what was dropped. But a downgrade needs the
-- app build that reads those tables, not this script.
-- ═════════════════════════════════════════════════════════════════════════════
--
-- alter table deals  add column if not exists script_due_date date;
-- alter table deals  add column if not exists shoot_date      date;
-- alter table deals  add column if not exists edit_done_date  date;
-- alter table deals  add column if not exists publish_date    date;
-- alter table brands add column if not exists contact_person  text;
-- alter table brands add column if not exists contact_phone   text;
-- alter table brands add column if not exists contact_email   text;
-- alter table reminders drop column if exists deal_stage_id;
-- drop table if exists push_tokens;
