-- ═════════════════════════════════════════════════════════════════════════════
-- 021: let a deal carry more than one payment
--
-- Run AFTER 020, and deploy the matching app build at the same time. Like 020,
-- this is not backward compatible, and for a reason worth understanding before
-- running it.
--
-- WHY
--
-- payments.deal_id has been UNIQUE since 001, so a deal could have exactly one
-- payment. But "50% advance, 50% on delivery" is the most common arrangement in
-- Indian creator work, and there was nowhere to record it. Creators either
-- logged the total and lost the advance, or logged two deals for one job.
--
-- WHAT BREAKS, AND WHY THE APP MUST SHIP WITH IT
--
-- That UNIQUE is not just a data rule. It is the only reason PostgREST treats
-- `payment:payments(...)` as a to-one relationship and returns an OBJECT.
-- Without it the same query returns an ARRAY, so every `deal.payment?.due_date`
-- in the app becomes undefined: no error, no warning, just blank payment data
-- everywhere. That is why this migration was held back from 019 and why the
-- build that reads `deal.payments[]` deploys alongside it.
--
-- Paste into the Supabase dashboard SQL editor. One transaction.
-- ═════════════════════════════════════════════════════════════════════════════


-- ── 1. Drop the uniqueness, by discovery ─────────────────────────────────────
-- Declared inline in 001 and never named, so the name is whatever Postgres
-- generated. Dropping by a guessed name would be a silent no-op that leaves the
-- constraint in place, and the failure would then look like "multiple payments
-- silently rejected" rather than "migration did nothing".

do $$
declare
  constraint_name text;
  dropped int := 0;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'payments'
      and con.contype = 'u'
      and pg_get_constraintdef(con.oid) like '%deal_id%'
  loop
    execute format('alter table payments drop constraint %I', constraint_name);
    raise notice 'Dropped uniqueness: %', constraint_name;
    dropped := dropped + 1;
  end loop;

  -- A unique INDEX rather than a constraint would enforce the same thing and
  -- survive the loop above untouched.
  for constraint_name in
    select i.relname
    from pg_index x
    join pg_class i on i.oid = x.indexrelid
    join pg_class t on t.oid = x.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'payments'
      and x.indisunique
      and not x.indisprimary
      and pg_get_indexdef(x.indexrelid) like '%deal_id%'
  loop
    execute format('drop index if exists %I', constraint_name);
    raise notice 'Dropped unique index: %', constraint_name;
    dropped := dropped + 1;
  end loop;

  if dropped = 0 then
    raise notice 'Nothing to drop: payments.deal_id was already non-unique.';
  end if;
end $$;


-- ── 2. Keep the lookup fast ──────────────────────────────────────────────────
-- The unique constraint was also serving as the index behind every
-- "payments for this deal" read. Removing it without replacing it turns each
-- of those into a sequential scan.

create index if not exists payments_deal_idx on payments (deal_id, sort_order);


-- ── 3. Verification ──────────────────────────────────────────────────────────

do $$
declare
  still_unique int;
begin
  select count(*) into still_unique
  from pg_index x
  join pg_class t on t.oid = x.indrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'payments'
    and x.indisunique
    and not x.indisprimary
    and pg_get_indexdef(x.indexrelid) like '%deal_id%';

  if still_unique > 0 then
    raise exception
      'payments.deal_id is still unique (% constraint/index). PostgREST would keep returning an object.',
      still_unique;
  end if;

  raise notice 'OK. A deal can now carry several payments.';
end $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- DOWN SCRIPT
--
-- Only safe while every deal still has at most one payment. If any deal has
-- two, this fails, and that is correct: restoring the constraint would
-- otherwise mean choosing a payment to delete.
-- ═════════════════════════════════════════════════════════════════════════════
--
-- alter table payments add constraint payments_deal_id_key unique (deal_id);
-- drop index if exists payments_deal_idx;
