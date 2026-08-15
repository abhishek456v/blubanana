-- ─────────────────────────────────────────────────────────────────────────────
-- CreatorDesk: reminder scheduling state (PRODUCT.md 2.3, 2.4)
-- Run this once in the Supabase dashboard SQL editor (or via supabase db push).
--
-- These columns are a client-side cache of what's currently scheduled as a
-- local OS notification on-device; Postgres can't schedule those itself.
-- Plain nullable columns (not a separate table) because there is only ever
-- one active reminder per deal/payment at a time, not a history log.
-- ─────────────────────────────────────────────────────────────────────────────

alter table deals
  add column reminder_stage           text check (reminder_stage in (
                                         'script_due', 'shoot', 'editing',
                                         'publish', 'live_link_submission'
                                       )),
  add column reminder_fire_at         timestamptz,
  add column reminder_notification_id text;

alter table payments
  add column due_soon_notification_id  text,
  add column due_today_notification_id text;
