-- ─────────────────────────────────────────────────────────────────────────────
-- Blubanana: invoice line items, so one invoice can cover several deals.
-- Run this once in the Supabase dashboard SQL editor, after 007.
--
-- Today an invoice is one row with one `description` and one `amount`, tied to
-- exactly one deal. That breaks the common case: three reels for the same
-- brand across a month, billed together. Sending three separate invoices for
-- one PO is not what the brand's finance team asked for.
--
-- `invoices.deal_id` stays, nullable, and keeps pointing at the originating
-- deal for single-deal invoices; getInvoiceForDeal() and the deal screen's
-- "Invoice" section both still read it. Consolidated invoices leave it null
-- and carry their deals on the line items instead.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Preconditions ────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'invoices'
  ) then
    raise exception 'Migration 006 (invoices) has not been applied. Run 006_phase2_phase3.sql first.';
  end if;
end $$;


-- ── Line items ───────────────────────────────────────────────────────────────

create table if not exists invoice_line_items (
  id          uuid    primary key default gen_random_uuid(),
  creator_id  uuid    not null references profiles(id) on delete cascade,
  invoice_id  uuid    not null references invoices(id) on delete cascade,

  -- Which deal this line bills for. Nullable so a creator can add an ad-hoc
  -- line (a reshoot, an expense) that has no deal behind it. `set null` rather
  -- than cascade: deleting a deal must never silently alter an issued invoice.
  deal_id     uuid    references deals(id) on delete set null,

  description text    not null,
  -- HSN/SAC is a GST requirement on the invoice. 998397 is "other advertising
  -- services", which is what brand collaborations fall under.
  hsn_sac     text    not null default '998397',
  quantity    integer not null default 1 check (quantity > 0),
  unit_amount integer not null default 0,  -- whole INR rupees
  amount      integer not null default 0,  -- quantity * unit_amount, stored
  sort_order  smallint not null default 0,

  created_at  timestamptz not null default now()
);

create index if not exists invoice_line_items_invoice_idx
  on invoice_line_items (creator_id, invoice_id, sort_order);

alter table invoice_line_items enable row level security;

drop policy if exists "invoice_line_items: own rows" on invoice_line_items;
create policy "invoice_line_items: own rows"
  on invoice_line_items for all
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);


-- ── invoices.deal_id becomes optional ────────────────────────────────────────
-- A consolidated invoice has no single originating deal. Existing rows keep
-- theirs, so nothing that reads deal_id changes behaviour.

alter table invoices alter column deal_id drop not null;


-- ── Backfill: every existing invoice becomes one line item ───────────────────
-- The old one-description/one-amount shape maps exactly onto a single line,
-- so no invoice loses information and the PDF renderer can read line items
-- uniformly instead of special-casing pre-migration invoices.

insert into invoice_line_items (
  creator_id, invoice_id, deal_id, description, quantity, unit_amount, amount, sort_order
)
select
  i.creator_id, i.id, i.deal_id, i.description, 1, i.amount, i.amount, 0
from invoices i
where not exists (
  select 1 from invoice_line_items li where li.invoice_id = i.id
);
