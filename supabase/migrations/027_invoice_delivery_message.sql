-- 027: Let an outbound message say it carried an invoice.
--
-- §8.8's "send the invoice over WhatsApp" reuses the channel already built for
-- payment nudges, and that table constrains `purpose` to a fixed list. Sending
-- an invoice as 'custom' would work and would be wrong: the message history on
-- the deal is the record of what was said to a brand and when, and "custom"
-- tells a creator looking back at a dispute nothing about whether the invoice
-- was ever actually sent.
--
-- The constraint is recreated under an explicit name. 014 let Postgres generate
-- one, and a generated name is not something a later migration can rely on.
--
-- Safe to re-run.

do $$
declare
  existing text;
begin
  -- Whatever it is called, drop it. The name from 014 is the default
  -- `outbound_messages_purpose_check`, but that is a convention rather than a
  -- guarantee, and a second constraint left behind would still reject the new
  -- value while this one accepted it.
  for existing in
    select conname from pg_constraint
    where conrelid = 'outbound_messages'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%purpose%'
  loop
    execute format('alter table outbound_messages drop constraint %I', existing);
  end loop;

  alter table outbound_messages add constraint outbound_messages_purpose_check
    check (purpose in (
      'delivery_notification',
      'payment_reminder_pre',
      'payment_reminder_due',
      'payment_reminder_overdue',
      'ad_rights_followup',
      'invoice_delivery',
      'custom'
    ));
end $$;


-- ── Verification ────────────────────────────────────────────────────────────
-- Checks the constraint accepts the new value and still rejects nonsense,
-- rather than merely that a constraint exists.

do $$
begin
  begin
    insert into outbound_messages (workspace_id, purpose, body, status)
    values ('00000000-0000-0000-0000-000000000000', 'invoice_delivery', 'probe', 'draft');
    raise exception 'Probe row was accepted, but it should have failed on the workspace FK';
  exception
    when foreign_key_violation then
      -- Reached the FK, which means the purpose check passed. That is the
      -- assertion: the row is never actually written.
      null;
    when check_violation then
      raise exception 'outbound_messages still rejects purpose = invoice_delivery';
  end;

  raise notice 'OK. invoice_delivery is an accepted message purpose.';
end $$;
