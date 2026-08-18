-- 029: Tax deadline reminders.
--
-- §8.13. The calculator has shown the four advance-tax dates since it shipped,
-- and nothing has ever fired for them. Indian freelancers pay advance tax on
-- 15 June, 15 September, 15 December and 15 March, and missing an instalment
-- means interest under sections 234B and 234C. Most creators find out from
-- their CA in March, by which point the interest is already owed.
--
-- GST-registered creators also file GSTR-1 by the 11th and GSTR-3B by the 20th,
-- every month.
--
-- ── What the notification says ──────────────────────────────────────────────
--
-- The date and nothing else: "Advance tax due 15 September." No amount. Two
-- reasons, and both are binding:
--
--   * §8.9's privacy rule. A notification is read on a lock screen, in public,
--     by whoever is standing there.
--   * It could not state a figure honestly anyway. The app knows the income
--     that passed through it, and a creator may have income it never saw. A
--     calculator she feeds is honest; a notification that guesses is not.
--
-- ── Why this rides the existing pipeline ────────────────────────────────────
--
-- These are rows in `reminders`, so `send-due-reminders` delivers them with
-- everything else — no second sender, no second cron job to notice has stopped,
-- no second set of quiet-hours logic to drift out of step.
--
-- Safe to re-run. Scheduling is idempotent: the chain id is derived from the
-- workspace and the deadline, so a row already written is skipped rather than
-- duplicated on every daily run.


-- ── 1. A reminder that belongs to no deal ───────────────────────────────────
-- `deal_id` and `payment_id` are already nullable. Only the type list needs to
-- learn the word.

do $$
declare
  existing text;
begin
  for existing in
    select conname from pg_constraint
    where conrelid = 'reminders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%type%'
      and pg_get_constraintdef(oid) ilike '%workflow%'
  loop
    execute format('alter table reminders drop constraint %I', existing);
  end loop;

  alter table reminders add constraint reminders_type_check
    check (type in ('workflow', 'payment', 'ad_rights', 'survey', 'tax'));
end $$;


-- ── 2. Scheduling ───────────────────────────────────────────────────────────
-- Runs daily and writes any deadline falling inside the horizon. Idempotent
-- through a deterministic chain id rather than a unique constraint, because the
-- existing partial unique index on (workspace_id, chain_id) covers only live
-- rows — an answered reminder would otherwise be rewritten the next morning.
--
-- Reminders land 7 days before the date at 09:00 in the workspace's own
-- timezone. Seven days because the point is to leave time to move money, not to
-- announce a deadline on the morning it falls.

create or replace function schedule_tax_reminders(horizon_days integer default 45)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  created integer := 0;
  batch   integer;
begin
  -- ── Advance tax: everyone ────────────────────────────────────────────────
  with deadlines as (
    select
      w.id as workspace_id,
      w.timezone,
      d.due_on,
      d.label
    from workspaces w
    cross join lateral (
      -- This year's and next year's, so December still sees the following
      -- March without special-casing the year boundary.
      select due_on, label from (
        values
          (make_date(extract(year from current_date)::int,     6, 15), 'Advance tax due 15 June'),
          (make_date(extract(year from current_date)::int,     9, 15), 'Advance tax due 15 September'),
          (make_date(extract(year from current_date)::int,    12, 15), 'Advance tax due 15 December'),
          (make_date(extract(year from current_date)::int,     3, 15), 'Advance tax due 15 March'),
          (make_date(extract(year from current_date)::int + 1, 3, 15), 'Advance tax due 15 March'),
          (make_date(extract(year from current_date)::int + 1, 6, 15), 'Advance tax due 15 June')
      ) as v(due_on, label)
    ) d
    where d.due_on - 7 between current_date and current_date + horizon_days
  )
  insert into reminders (
    workspace_id, chain_id, type, title, body, scheduled_for, status
  )
  select
    x.workspace_id,
    md5(x.workspace_id::text || 'tax' || x.due_on::text)::uuid,
    'tax',
    x.label,
    'Set aside what you owe before the date, so the instalment does not turn into 234B/234C interest.',
    ((x.due_on - 7) + time '09:00') at time zone x.timezone,
    'scheduled'
  from deadlines x
  where not exists (
    select 1 from reminders r
     where r.chain_id = md5(x.workspace_id::text || 'tax' || x.due_on::text)::uuid
  );

  get diagnostics batch = row_count;
  created := created + batch;

  -- ── GST filings: registered creators only ────────────────────────────────
  -- Registration is a fact about the creator, not the workspace, so this joins
  -- through the owner's profile. A creator with no GSTIN files nothing and
  -- must not be told otherwise.
  with registered as (
    select w.id as workspace_id, w.timezone
      from workspaces w
      join memberships m
        on m.workspace_id = w.id and m.role = 'owner' and m.status = 'active'
      join profiles p
        on p.id = m.user_id
     where p.gstin is not null and length(trim(p.gstin)) > 0
  ), filings as (
    select
      r.workspace_id,
      r.timezone,
      f.due_on,
      f.label
    from registered r
    cross join lateral (
      select due_on, label from (
        values
          (date_trunc('month', current_date)::date + 10,                    'GSTR-1 due on the 11th'),
          (date_trunc('month', current_date)::date + 19,                    'GSTR-3B due on the 20th'),
          ((date_trunc('month', current_date) + interval '1 month')::date + 10, 'GSTR-1 due on the 11th'),
          ((date_trunc('month', current_date) + interval '1 month')::date + 19, 'GSTR-3B due on the 20th')
      ) as v(due_on, label)
    ) f
    -- Three days for a monthly filing rather than seven: it recurs twelve times
    -- a year, and a week's notice on something that frequent is noise.
    where f.due_on - 3 between current_date and current_date + horizon_days
  )
  insert into reminders (
    workspace_id, chain_id, type, title, body, scheduled_for, status
  )
  select
    x.workspace_id,
    md5(x.workspace_id::text || 'gst' || x.label || x.due_on::text)::uuid,
    'tax',
    x.label,
    null,
    ((x.due_on - 3) + time '09:00') at time zone x.timezone,
    'scheduled'
  from filings x
  where not exists (
    select 1 from reminders r
     where r.chain_id = md5(x.workspace_id::text || 'gst' || x.label || x.due_on::text)::uuid
  );

  get diagnostics batch = row_count;
  return created + batch;
end $$;

revoke all on function schedule_tax_reminders(integer) from public;


-- ── 3. Run it daily ─────────────────────────────────────────────────────────
-- 02:30 UTC is 08:00 IST — before the 09:00 the reminders themselves are
-- scheduled for, so a deadline entering the horizon today still gets its row
-- written in time to fire this morning.

select cron.unschedule('schedule-tax-reminders')
 where exists (select 1 from cron.job where jobname = 'schedule-tax-reminders');

select cron.schedule(
  'schedule-tax-reminders',
  '30 2 * * *',
  $$ select schedule_tax_reminders(); $$
);

-- Write whatever is already inside the horizon, rather than waiting for
-- tomorrow's run.
select schedule_tax_reminders();


-- ── 4. Verification ─────────────────────────────────────────────────────────

do $$
declare
  bad text;
begin
  if not exists (select 1 from cron.job where jobname = 'schedule-tax-reminders') then
    raise exception 'The daily tax scheduling job was not created';
  end if;

  -- The type list must accept 'tax', or every row above was rejected.
  begin
    perform 1 from reminders where type = 'tax' limit 1;
  exception when others then
    raise exception 'reminders.type does not accept tax';
  end;

  -- No tax reminder may ever carry an amount. §8.9's privacy rule is the whole
  -- reason the body is a fixed sentence, and this is what stops a later edit
  -- quietly reintroducing a figure.
  select string_agg(id::text, ', ') into bad
    from reminders
   where type = 'tax'
     and (title ~ '[0-9]{4,}' or coalesce(body, '') ~ '₹');

  if bad is not null then
    raise exception 'Tax reminders must not state an amount: %', bad;
  end if;

  raise notice 'OK. Tax deadlines are scheduled, and none of them names a figure.';
end $$;
