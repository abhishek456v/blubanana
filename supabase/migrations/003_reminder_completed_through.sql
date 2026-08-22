-- ─────────────────────────────────────────────────────────────────────────────
-- Blubanana: fix reminder rescheduling floor (PRODUCT.md 2.3)
-- Run this once in the Supabase dashboard SQL editor (or via supabase db push).
--
-- reminder_stage alone isn't enough to know which stages are safe to
-- resurface: it can point at a later stage merely because an earlier one
-- had no date yet the last time it was computed, not because the creator
-- actually marked that earlier stage Done. reminder_completed_through
-- tracks the latter explicitly; see lib/reminders.ts.
-- ─────────────────────────────────────────────────────────────────────────────

alter table deals
  add column reminder_completed_through text check (reminder_completed_through in (
    'script_due', 'shoot', 'editing', 'publish', 'live_link_submission'
  ));
