-- ─────────────────────────────────────────────────────────────────────────────
-- Blubanana: the fields a GST tax invoice is legally required to carry.
-- Run this once in the Supabase dashboard SQL editor, after 017.
--
-- The invoice this app generates was not a valid tax invoice whenever GST was
-- charged. Rule 46 of the CGST Rules requires the supplier's address, the
-- recipient's GSTIN and address where registered, the place of supply, and the
-- tax split by head. It printed a single "GST @ 18%" line and none of the rest,
-- which is the kind of thing a brand's finance team rejects, holding up a
-- payment this product exists to protect.
--
-- The split matters most. Under the IGST Act a supply is inter-State when the
-- supplier's State differs from the place of supply, and intra-State when they
-- match. Inter-State carries IGST at the full rate; intra-State carries CGST
-- and SGST at half each. A recipient cannot claim input credit against the
-- wrong head, so one merged line is not a rounding issue, it is unusable.
--
-- Amounts stay integer rupees (see types/index.ts on why).
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Supplier ────────────────────────────────────────────────────────────────
-- Rule 46(a): the supplier's address is mandatory on a tax invoice. State is
-- derivable from the GSTIN's first two characters, so it is not stored twice.
alter table profiles add column if not exists address text;

-- ── Recipient ───────────────────────────────────────────────────────────────
-- Held on the brand so the creator types it once, then snapshotted onto each
-- invoice below. state_code is kept separately from the GSTIN because an
-- unregistered brand still has a place of supply.
alter table brands add column if not exists gstin      text;
alter table brands add column if not exists address    text;
alter table brands add column if not exists state_code text;

-- ── The invoice's own copy ──────────────────────────────────────────────────
-- Snapshotted at generation time for the same reason brand_name already is:
-- editing a brand later must never alter a document that has been sent.
alter table invoices add column if not exists brand_gstin           text;
alter table invoices add column if not exists brand_address         text;
alter table invoices add column if not exists place_of_supply_code  text;
alter table invoices add column if not exists supplier_address      text;

-- Rule 46(k)/(l): rate and amount of tax, per head, shown separately.
alter table invoices add column if not exists cgst_amount integer not null default 0;
alter table invoices add column if not exists sgst_amount integer not null default 0;
alter table invoices add column if not exists igst_amount integer not null default 0;

-- Rule 46(o): whether tax is payable on reverse charge. Always false for a
-- creator's own services, but the invoice has to say so explicitly.
alter table invoices add column if not exists reverse_charge boolean not null default false;

-- Deliberately NOT backfilled. Invoices issued before this migration have a
-- gst_amount but no recorded place of supply, so which head it belonged to is
-- genuinely unknown. Splitting them now would be inventing a tax position on a
-- document that has already been sent. lib/invoiceHtml.ts detects the all-zero
-- split and prints those as a single legacy GST line instead.

-- ── Constraint: the split must reconcile ────────────────────────────────────
-- The one thing that must never happen on an invoice is a total that does not
-- agree with its parts. Enforced here rather than in the service layer so a
-- hand-run UPDATE cannot produce a document that does not add up.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'invoices_gst_split_reconciles'
  ) then
    alter table invoices add constraint invoices_gst_split_reconciles check (
      -- Legacy rows: no split recorded at all.
      (cgst_amount = 0 and sgst_amount = 0 and igst_amount = 0)
      -- Or the heads add back to exactly the tax charged.
      or (cgst_amount + sgst_amount + igst_amount = gst_amount)
    );
  end if;
end $$;

-- A supply is either inter-State or intra-State, never both.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'invoices_gst_single_head'
  ) then
    alter table invoices add constraint invoices_gst_single_head check (
      igst_amount = 0 or (cgst_amount = 0 and sgst_amount = 0)
    );
  end if;
end $$;

do $$
declare
  missing text;
begin
  select string_agg(c, ', ') into missing
  from unnest(array[
    'brand_gstin','brand_address','place_of_supply_code','supplier_address',
    'cgst_amount','sgst_amount','igst_amount','reverse_charge'
  ]) as c
  where not exists (
    select 1 from information_schema.columns
    where table_name = 'invoices' and column_name = c
  );

  if missing is not null then
    raise exception '018 failed: invoices is missing %', missing;
  end if;

  raise notice '018 ok: tax-invoice fields present, split constraints active';
end $$;
