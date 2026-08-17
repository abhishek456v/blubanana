-- ═════════════════════════════════════════════════════════════════════════════
-- 020: collapse deal status to a lifecycle
--
-- Run AFTER 019, and deploy the matching app build at the same time. This one
-- is not backward compatible: the old status values stop being accepted the
-- moment it runs.
--
-- WHY
--
-- Status used to be seven values: intake, script_due, shooting, editing,
-- published, payment_awaited, paid. Four of those were the four fixed workflow
-- stages, which was coherent while every deal had exactly those stages.
--
-- 019 made stages user-defined, and that broke the arrangement. A creator who
-- renames "Shoot" to "Studio day" still had a status pill reading "Shoot". A
-- creator who adds a client-review round has a fifth stage no status can
-- express. A creator who deletes "Edit" can still be in status 'editing'. And
-- nothing kept the two in sync in either direction, so they drifted.
--
-- So status stops describing the work. The stages describe the work; status
-- now describes only where the deal sits in its commercial lifecycle:
--
--   active  the work is in progress. Which part is a question for the stages
--   live    published, so the payment clock has started
--   unpaid  invoiced or due, money not received
--   paid    settled
--
-- Nothing is lost. "Which stage is this deal on" is now answered by the first
-- stage that is not done, under its real name, which is strictly more
-- information than the old enum could carry.
--
-- Paste into the Supabase dashboard SQL editor. One transaction: the
-- verification block at the end raises on anything unexpected, rolling the
-- whole migration back.
-- ═════════════════════════════════════════════════════════════════════════════


-- ── 1. Widen the constraint before rewriting the data ────────────────────────
-- The check has to accept both vocabularies for the duration of the update,
-- otherwise the very first row rewritten violates it.
--
-- The existing constraint is dropped by discovery rather than by name. It was
-- declared inline in 001 and never named, so its name is whatever Postgres
-- generated. `drop constraint if exists deals_status_check` would be a silent
-- no-op if that guess were wrong, leaving the old check in place to reject
-- every row the next statement rewrites.

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'deals'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%intake%'
  loop
    execute format('alter table deals drop constraint %I', constraint_name);
    raise notice 'Dropped legacy status check: %', constraint_name;
  end loop;
end $$;

alter table deals add constraint deals_status_check check (status in (
  'intake', 'script_due', 'shooting', 'editing', 'published', 'payment_awaited',
  'active', 'live', 'unpaid', 'paid'
));


-- ── 2. Rewrite the data ──────────────────────────────────────────────────────
-- Every pre-publish status collapses to 'active'. That is the whole point: the
-- distinction between them lived in the stage names, and the stages already
-- hold it (019 backfilled `done` from exactly these values).

update deals set status = 'active'
  where status in ('intake', 'script_due', 'shooting', 'editing');

update deals set status = 'live'   where status = 'published';
update deals set status = 'unpaid' where status = 'payment_awaited';
-- 'paid' is unchanged and deliberately not listed.


-- ── 3. Narrow the constraint to the new vocabulary ───────────────────────────

alter table deals drop constraint if exists deals_status_check;

alter table deals add constraint deals_status_check check (status in (
  'active', 'live', 'unpaid', 'paid'
));

alter table deals alter column status set default 'active';


-- ── 4. Verification ──────────────────────────────────────────────────────────

do $$
declare
  legacy   bigint;
  breakdown text;
begin
  select count(*) into legacy from deals
  where status not in ('active', 'live', 'unpaid', 'paid');

  if legacy > 0 then
    raise exception '% deal(s) still carry a legacy status.', legacy;
  end if;

  -- Every deal must still have stages, or the app has no way left to say what
  -- the deal is working on: this migration removed the fallback.
  if exists (
    select 1 from deals d
    where not exists (select 1 from deal_stages s where s.deal_id = d.id)
  ) then
    raise exception
      'Some deals have no stages. Re-run the backfill in 019 before this.';
  end if;

  select string_agg(status || '=' || n, ', ' order by status)
    into breakdown
  from (select status, count(*) as n from deals group by status) t;

  raise notice 'OK. Deal statuses now: %', breakdown;
end $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- DOWN SCRIPT
--
-- Only partially reversible, and worth knowing why before running 020.
-- Collapsing four pre-publish statuses into 'active' discards which of them a
-- deal was in. Reversing puts every active deal back to 'intake' rather than
-- to the specific stage it held.
--
-- That loss is acceptable only because the information still exists in
-- deal_stages: the first stage that is not done says the same thing, by name.
-- ═════════════════════════════════════════════════════════════════════════════
--
-- alter table deals drop constraint if exists deals_status_check;
-- update deals set status = 'intake'          where status = 'active';
-- update deals set status = 'published'       where status = 'live';
-- update deals set status = 'payment_awaited' where status = 'unpaid';
-- alter table deals add constraint deals_status_check check (status in (
--   'intake', 'script_due', 'shooting', 'editing',
--   'published', 'payment_awaited', 'paid'
-- ));
-- alter table deals alter column status set default 'intake';
