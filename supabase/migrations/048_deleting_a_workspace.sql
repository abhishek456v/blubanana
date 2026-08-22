-- Deleting a workspace was impossible if anything was in it.
--
-- ── What happened ───────────────────────────────────────────────────────────
--
-- `delete from workspaces where id = ...` cascades to that workspace's deals,
-- invoices and payments. Each of those carries the `log_money_change` trigger,
-- which writes a row to `audit_logs` on delete. By the time it fires, the
-- workspace row is already gone, and `audit_logs.workspace_id` references
-- `workspaces`. So the audit insert failed the foreign key, and the failure
-- took the whole delete with it:
--
--   insert or update on table "audit_logs" violates foreign key constraint
--   Key (workspace_id)=(...) is not present in table "workspaces"
--
-- ── Why this mattered more than it looks ────────────────────────────────────
--
-- `delete-account` deletes the creator's workspaces. So "Delete my account"
-- worked only for somebody who had never added a deal, an invoice or a
-- payment, which is to say it worked for nobody who had actually used the
-- product. It failed with a database error, at the one moment a person has
-- decided to leave.
--
-- It is also an obligation. Erasure under the DPDP Act is not a feature that
-- can be broken and caught later, and there is now a register in the dashboard
-- promising it inside thirty days.
--
-- ── The fix ─────────────────────────────────────────────────────────────────
--
-- Do not write an audit row about a deletion inside a workspace that is itself
-- being deleted. There is nothing left for the record to be about, and nowhere
-- for it to hang: the whole workspace, including its audit log, is going.
--
-- Deliberately narrow. The check is "does this workspace still exist", which
-- is false only during a cascade from `workspaces`. Deleting a single deal in
-- a live workspace still records exactly what it always did.

create or replace function log_money_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
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

    -- The workspace is going too. Nothing to record, and nowhere to record it.
    if not exists (select 1 from workspaces w where w.id = ws) then
      return old;
    end if;

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
    -- `is distinct from` rather than <> so a null to value transition counts as
    -- a change; with <> it would evaluate to null and be silently skipped.
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
$function$;
