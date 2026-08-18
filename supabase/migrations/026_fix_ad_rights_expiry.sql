-- 026: Correct every ad-rights expiry date stored a day early.
--
-- `calculateAdRightsExpiry()` built a local-midnight Date and serialised it
-- with `toISOString()`. Local midnight in IST (+05:30) is still the previous
-- day in UTC, so every expiry computed on an Indian device was stored one day
-- short — and `rescheduleAdRightsReminder()` scheduled its 30-day warning
-- against that short date, firing a day early too.
--
-- The bug was invisible: the date looked plausible, and the only way to notice
-- was to compute the same thing twice. `lib/deliverables.ts` had a second,
-- correct implementation of the identical calculation sitting a few files
-- away, which is how it surfaced. Both now call one `addMonths()` helper.
--
-- This recomputes from `ad_rights_start_date + ad_rights_duration_months`
-- rather than adding a day to what is there. Adding a day would corrupt any
-- row that happened to be stored correctly — a deal entered from a UTC or
-- behind-UTC device, or one edited by hand. Recomputing is idempotent and
-- right regardless of how the current value got there.
--
-- Note on month-end: Postgres `date + interval '1 month'` clamps (31 Jan + 1
-- month = 28 Feb). `addMonths()` was changed to clamp identically, so this
-- backfill and every future write agree. Before that change they would have
-- diverged by up to three days on month-end contracts.
--
-- Not fixed here, because it cannot be: notifications already scheduled on a
-- device hold the old date. They correct themselves the next time that deal is
-- saved, which reschedules from the stored value.
--
-- Safe to re-run — it is a no-op once the dates agree.

do $$
declare
  corrected integer;
begin
  update deals
     set ad_rights_expires_date =
           (ad_rights_start_date + (ad_rights_duration_months || ' months')::interval)::date
   where ad_rights_start_date is not null
     and ad_rights_duration_months is not null
     and ad_rights_expires_date is distinct from
           (ad_rights_start_date + (ad_rights_duration_months || ' months')::interval)::date;

  get diagnostics corrected = row_count;
  raise notice 'Corrected % ad-rights expiry date(s).', corrected;
end $$;


-- ── Verification ────────────────────────────────────────────────────────────

do $$
declare
  wrong integer;
begin
  select count(*) into wrong
    from deals
   where ad_rights_start_date is not null
     and ad_rights_duration_months is not null
     and ad_rights_expires_date is distinct from
           (ad_rights_start_date + (ad_rights_duration_months || ' months')::interval)::date;

  if wrong > 0 then
    raise exception '% ad-rights expiry date(s) still disagree with start + duration', wrong;
  end if;

  raise notice 'OK. Every ad-rights expiry matches its start date plus its duration.';
end $$;
