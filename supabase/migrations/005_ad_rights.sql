-- ─────────────────────────────────────────────────────────────────────────────
-- Blubanana: Ad Rights tracking on deals.
-- Run this once in the Supabase dashboard SQL editor (or via supabase db push).
--
-- Ad rights are an optional add-on term on a deal: the brand pays an extra
-- fee for the right to reuse the creator's content in paid ads for a fixed
-- window. expires_date is stored (not computed on read) so it can be
-- queried directly for the "flag if still running past expiry" use case and
-- so the 30-day-before reminder has a stable date to schedule against.
-- reminder_notification_id mirrors payments.due_soon_notification_id: a
-- client-side cache of the local OS notification currently scheduled.
-- ─────────────────────────────────────────────────────────────────────────────

-- `if not exists` throughout so this is safe to re-run against a database
-- where it may already be partly applied.
alter table deals
  add column if not exists ad_rights_granted             boolean not null default false,
  add column if not exists ad_rights_fee                 integer,
  add column if not exists ad_rights_duration_months     integer,
  add column if not exists ad_rights_start_date          date,
  add column if not exists ad_rights_expires_date        date,
  add column if not exists ad_rights_reminder_notification_id text;
