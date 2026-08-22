-- ─────────────────────────────────────────────────────────────────────────────
-- Blubanana: audit log for money and status changes.
-- Run this once in the Supabase dashboard SQL editor, after 010.
--
-- The functional spec's rule: "Money data is never silently modified. Every
-- change to an amount, a due date, or a payment status is logged with who and
-- when."
--
-- Written as a database trigger rather than as calls in the service layer, and
-- that choice is the whole point. A service-layer audit records what the app
-- meant to do; a trigger records what actually happened to the row, including
-- a hand-run UPDATE in the SQL editor at 2am, which is exactly the change
-- you'd most want a record of during a payment dispute.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────


create table if not exists audit_logs (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  -- Null when the change came from somewhere with no session: a SQL editor
  -- statement, a cron job, a service-role script. That null is information.
  actor_user_id uuid       references profiles(id) on delete set null,

  entity_type  text        not null,   -- 'deal' | 'payment' | 'invoice' | ...
  entity_id    uuid        not null,
  action       text        not null check (action in ('create', 'update', 'delete')),

  -- Only the fields that actually changed, as {field: {from, to}}. Storing the
  -- whole row before and after would make every payment update carry a copy of
  -- the deal, and make "what changed?" a diffing exercise at read time.
  changes      jsonb       not null default '{}'::jsonb,

  created_at   timestamptz not null default now()
);

create index if not exists audit_logs_entity_idx
  on audit_logs (workspace_id, entity_type, entity_id, created_at desc);
create index if not exists audit_logs_workspace_idx
  on audit_logs (workspace_id, created_at desc);

alter table audit_logs enable row level security;

-- Read-only to the app. There is no insert/update/delete policy on purpose:
-- the trigger below writes as SECURITY DEFINER, and an audit trail the audited
-- party can edit is not an audit trail.
drop policy if exists "audit_logs: workspace members read" on audit_logs;
create policy "audit_logs: workspace members read"
  on audit_logs for select
  using (workspace_id in (select auth_workspace_ids()));


-- ── The trigger ──────────────────────────────────────────────────────────────
-- Watches only the columns worth watching. A note being edited is not an audit
-- event; a rate, a due date or a payment status changing is.

create or replace function log_money_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  watched  text[] := array[
    'rate', 'amount', 'unit_amount', 'total_amount', 'gst_amount', 'tds_amount',
    'ad_rights_fee', 'status', 'due_date', 'paid_date', 'payment_due_date',
    'invoice_number', 'gst_applicable', 'tds_deducted'
  ];
  field    text;
  old_json jsonb;
  new_json jsonb;
  diff     jsonb := '{}'::jsonb;
  ws       uuid;
begin
  if tg_op = 'DELETE' then
    old_json := to_jsonb(old);
    ws := (old_json->>'workspace_id')::uuid;
    insert into audit_logs (workspace_id, actor_user_id, entity_type, entity_id, action, changes)
    values (ws, auth.uid(), tg_argv[0], (old_json->>'id')::uuid, 'delete', old_json);
    return old;
  end if;

  new_json := to_jsonb(new);
  ws := (new_json->>'workspace_id')::uuid;

  if tg_op = 'INSERT' then
    insert into audit_logs (workspace_id, actor_user_id, entity_type, entity_id, action, changes)
    values (ws, auth.uid(), tg_argv[0], (new_json->>'id')::uuid, 'create', new_json);
    return new;
  end if;

  old_json := to_jsonb(old);
  foreach field in array watched loop
    -- `is distinct from` rather than <> so a null↔value transition counts as a
    -- change; with <> it would evaluate to null and be silently skipped.
    if (old_json ? field or new_json ? field)
       and (old_json->field) is distinct from (new_json->field) then
      diff := diff || jsonb_build_object(
        field, jsonb_build_object('from', old_json->field, 'to', new_json->field));
    end if;
  end loop;

  if diff <> '{}'::jsonb then
    insert into audit_logs (workspace_id, actor_user_id, entity_type, entity_id, action, changes)
    values (ws, auth.uid(), tg_argv[0], (new_json->>'id')::uuid, 'update', diff);
  end if;

  return new;
end;
$$;


-- ── Attach to the tables that hold money or a settlement state ───────────────

drop trigger if exists deals_audit on deals;
create trigger deals_audit
  after insert or update or delete on deals
  for each row execute function log_money_change('deal');

drop trigger if exists payments_audit on payments;
create trigger payments_audit
  after insert or update or delete on payments
  for each row execute function log_money_change('payment');

drop trigger if exists invoices_audit on invoices;
create trigger invoices_audit
  after insert or update or delete on invoices
  for each row execute function log_money_change('invoice');

drop trigger if exists deal_deliverables_audit on deal_deliverables;
create trigger deal_deliverables_audit
  after insert or update or delete on deal_deliverables
  for each row execute function log_money_change('deliverable');


do $$
begin
  raise notice 'Audit logging active on deals, payments, invoices and deliverables.';
end $$;
