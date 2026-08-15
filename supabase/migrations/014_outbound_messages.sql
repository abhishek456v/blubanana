-- ─────────────────────────────────────────────────────────────────────────────
-- CreatorDesk: the outbound message log.
-- Run this once in the Supabase dashboard SQL editor, after 013.
--
-- Every message the app drafts for a brand (delivery notifications, the four
-- escalating payment chasers, ad-rights follow-ups) is a row here before it
-- goes anywhere. Three reasons that matters more than it looks:
--
--   1. The functional spec's hardest rule is "nothing is ever sent to a brand
--      without her explicit approval". A table with an approval gate makes that
--      checkable; a button that opens WhatsApp does not.
--   2. During a payment dispute, "I chased them on the 3rd, the 10th and the
--      24th" is the creator's evidence. Right now that history exists only in
--      her WhatsApp scrollback.
--   3. It is what stops the app nagging: the reminder engine can see that a
--      chaser already went out today and not draft another.
--
-- Safe to re-run.
--
--
-- ON WHAT "SENT" MEANS HERE
--
-- Messages go out through a wa.me link that opens the creator's own WhatsApp
-- with the text pre-filled: her real number, her real thread with the brand.
-- The trade-off is that the handoff is the last thing this app can observe:
-- once WhatsApp opens, there is no callback telling us she pressed send.
--
-- So `sent_at` means "handed to WhatsApp", not "delivered". The column is named
-- `handed_off_at` precisely so nothing downstream can mistake it for delivery
-- confirmation. If the WhatsApp Business API is adopted later, a real
-- `delivered_at` joins it rather than replacing it.
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


create table if not exists outbound_messages (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  uuid        not null references workspaces(id) on delete cascade,

  deal_id       uuid        references deals(id) on delete cascade,
  payment_id    uuid        references payments(id) on delete set null,

  channel       text        not null default 'whatsapp'
                  check (channel in ('whatsapp', 'email', 'sms')),
  purpose       text        not null check (purpose in (
                  'delivery_notification',
                  'payment_reminder_pre',
                  'payment_reminder_due',
                  'payment_reminder_overdue',
                  'ad_rights_followup',
                  'custom'
                )),
  -- 0 for a first, friendly nudge; rises with each chaser. Drives both the
  -- tone of the drafted copy and how firmly the UI presents it.
  escalation_level smallint not null default 0,

  recipient     text,       -- E.164 or email, snapshotted at draft time
  body          text        not null,

  status        text        not null default 'draft'
                  check (status in ('draft', 'approved', 'sent', 'cancelled')),

  -- The approval gate. See the constraint below.
  approved_by   uuid        references profiles(id) on delete set null,
  approved_at   timestamptz,

  -- Deliberately not called sent_at. See the header: this records the moment
  -- the message was handed to WhatsApp, which is not proof it was delivered.
  handed_off_at timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Human approval enforced by the database, not by a code convention. A row
  -- physically cannot reach 'approved' or 'sent' without a recorded approver,
  -- so no future code path, or hand-run UPDATE, can bypass it.
  constraint approval_required_before_send check (
    status in ('draft', 'cancelled')
    or (approved_by is not null and approved_at is not null)
  )
);

create index if not exists outbound_messages_deal_idx
  on outbound_messages (workspace_id, deal_id, created_at desc);

-- Answers "has a chaser already gone out for this payment?" without scanning.
create index if not exists outbound_messages_payment_idx
  on outbound_messages (workspace_id, payment_id, created_at desc)
  where payment_id is not null;

alter table outbound_messages enable row level security;
alter table outbound_messages force  row level security;

drop policy if exists "outbound_messages: workspace members" on outbound_messages;
create policy "outbound_messages: workspace members"
  on outbound_messages for all
  using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

drop trigger if exists outbound_messages_updated_at on outbound_messages;
create trigger outbound_messages_updated_at
  before update on outbound_messages
  for each row execute function set_updated_at();

-- Message bodies quote amounts and due dates, so changes to them belong in the
-- same audit trail as the money itself.
drop trigger if exists outbound_messages_audit on outbound_messages;
create trigger outbound_messages_audit
  after insert or update or delete on outbound_messages
  for each row execute function log_money_change('message');


do $$
begin
  raise notice 'Outbound message log ready. Approval is enforced by check constraint.';
end $$;
