-- ─────────────────────────────────────────────────────────────────────────────
-- CreatorDesk: durable reminder chains.
-- Run this once in the Supabase dashboard SQL editor, after 014.
--
-- Reminders currently exist only as local OS notifications, with a couple of
-- cache columns on `deals` recording what was scheduled. That makes the
-- product's first promise, "she never misses a deadline", depend on the
-- phone not tidying up: reinstall the app, switch device, or let the OS clear
-- notifications, and the entire schedule is gone with no way to rebuild it.
--
-- Moving the schedule into the database fixes that. Delivery still happens
-- through local notifications for now (no push credentials yet), but the app
-- can rebuild them from the database at any time, on any device. When push is
-- set up, a scheduled job delivers from the same rows; the data model does
-- not change, only who reads it.
--
-- Safe to re-run.
--
--
-- THE RULE THIS TABLE EXISTS TO ENFORCE
--
-- "Only one reminder in a chain is live at a time, and the next one fires only
-- after the current one is answered."
--
-- That is what stops the app becoming background noise. It is enforced by the
-- partial unique index below, not by application logic, so a scheduler bug, a
-- double-tap, or a retried job physically cannot produce two live nudges for
-- the same piece of work.
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


create table if not exists reminders (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  uuid        not null references workspaces(id) on delete cascade,

  -- Groups the reminders belonging to one piece of work. A deal's workflow is
  -- one chain; each payment gets its own.
  chain_id      uuid        not null,
  sequence_index smallint   not null default 0,
  -- Set when this reminder was created by snoozing another, so the full nudge
  -- history stays walkable rather than being overwritten in place.
  parent_reminder_id uuid   references reminders(id) on delete set null,

  type          text        not null check (type in ('workflow', 'payment', 'ad_rights', 'survey')),
  stage         text,       -- script_due | shoot | editing | publish | live_link_submission

  deal_id       uuid        references deals(id) on delete cascade,
  payment_id    uuid        references payments(id) on delete cascade,

  title         text        not null,
  body          text,
  scheduled_for timestamptz not null,

  status        text        not null default 'scheduled' check (status in (
                  'scheduled',    -- waiting for its time
                  'sent',         -- delivered, awaiting a response
                  'acknowledged', -- she tapped Done
                  'snoozed',      -- superseded by a child reminder
                  'escalated',    -- no response after 24h, re-sent harder
                  'cancelled',    -- deal moved on, or dates changed
                  'expired'
                )),

  escalation_level smallint  not null default 0,
  -- Real data, not just a counter: three snoozes on one stage is the signal
  -- that a deadline is in trouble, and the dashboard flags the deal.
  snooze_count     smallint  not null default 0,

  sent_at        timestamptz,
  responded_at   timestamptz,

  -- The OS notification currently scheduled for this row, so the client can
  -- cancel it when the reminder is answered or rebuilt. Null once push
  -- delivery replaces local scheduling.
  local_notification_id text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── THE CHAIN RULE ───────────────────────────────────────────────────────────
-- At most one live reminder per chain. The database physically cannot hold two.
create unique index if not exists reminders_one_live_per_chain
  on reminders (workspace_id, chain_id)
  where status in ('scheduled', 'sent', 'escalated');

-- The scheduler's hot path: "what is due?"
create index if not exists reminders_due_idx
  on reminders (scheduled_for) where status = 'scheduled';

create index if not exists reminders_deal_idx
  on reminders (workspace_id, deal_id, created_at desc);

alter table reminders enable row level security;
alter table reminders force  row level security;

drop policy if exists "reminders: workspace members" on reminders;
create policy "reminders: workspace members"
  on reminders for all
  using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

drop trigger if exists reminders_updated_at on reminders;
create trigger reminders_updated_at
  before update on reminders
  for each row execute function set_updated_at();


-- ── Quiet hours ──────────────────────────────────────────────────────────────
-- A deadline nudge at 3am is worse than no nudge: it gets dismissed half-asleep
-- and the chain stalls waiting for a response that already happened.
--
-- Shifts a timestamp forward to the next moment outside the workspace's quiet
-- window. Deliberately never shifts backward: a reminder may be late, but it
-- must never fire before the work was due.

create or replace function next_wakeful_time(p_workspace uuid, p_at timestamptz)
returns timestamptz
language plpgsql
stable
as $$
declare
  q_start  time;
  q_end    time;
  tz       text;
  t_of_day time;
begin
  select quiet_hours_start, quiet_hours_end, timezone
    into q_start, q_end, tz
    from workspaces where id = p_workspace;

  if not found then return p_at; end if;

  t_of_day := (p_at at time zone tz)::time;

  -- The window normally wraps midnight (22:00 → 08:00), so "inside it" means
  -- after the start OR before the end. A non-wrapping window is the simple
  -- between case.
  if q_start > q_end then
    if t_of_day >= q_start then
      -- Late evening: next morning's opening.
      return ((p_at at time zone tz)::date + 1 + q_end) at time zone tz;
    elsif t_of_day < q_end then
      -- Small hours: this morning's opening.
      return ((p_at at time zone tz)::date + q_end) at time zone tz;
    end if;
  elsif t_of_day >= q_start and t_of_day < q_end then
    return ((p_at at time zone tz)::date + q_end) at time zone tz;
  end if;

  return p_at;
end;
$$;


-- Reminder bodies quote amounts and dates, and a silently cancelled chain is
-- exactly the kind of change worth being able to explain later.
drop trigger if exists reminders_audit on reminders;
create trigger reminders_audit
  after insert or update or delete on reminders
  for each row execute function log_money_change('reminder');


do $$
begin
  raise notice 'Reminder chains ready. One live reminder per chain is enforced by unique index.';
end $$;
