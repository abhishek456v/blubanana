-- ─────────────────────────────────────────────────────────────────────────────
-- CreatorDesk — Phase 2 & 3 features.
-- Run this once in the Supabase dashboard SQL editor (or via supabase db push),
-- after 004 and 005.
--
-- Covers: client reputation scoring, rate benchmarking (follower snapshot),
-- manual content performance tracking, tax/GST invoicing, and the shareable
-- public creator profile card. Niche-based rate intelligence and live
-- Instagram/YouTube performance sync are intentionally NOT included here —
-- the former needs a real user population to benchmark against, the latter
-- needs Instagram Graph API / YouTube Data API credentials that haven't been
-- set up yet.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Profiles: billing details, niche, public profile opt-in ──────────────────

alter table profiles
  add column upi_id              text,
  add column bank_account_number text,
  add column ifsc_code           text,
  add column gstin                text,
  add column niche                text,
  add column public_profile_enabled boolean not null default false,
  add column public_share_slug    text unique;


-- ── Deals: rate-benchmarking snapshot + manual performance numbers ───────────

alter table deals
  -- Snapshot of the creator's follower count at the moment this deal was
  -- created — lib/rateBenchmark.ts compares rate-per-follower across deals
  -- over time using this, without needing any social API integration.
  add column creator_follower_count_at_time integer,
  -- Manual content performance entry (PRODUCT.md explicitly deferred
  -- automated Instagram/YouTube polling to Phase 2 — this is the
  -- creator-entered stand-in until real API credentials exist).
  add column performance_views      integer,
  add column performance_likes      integer,
  add column performance_comments   integer,
  add column performance_saves      integer,
  add column performance_updated_at timestamptz;


-- ── Client reputation score ───────────────────────────────────────────────────
-- One review per deal, prompted once a deal reaches 'paid'. Kept as a table
-- (not just an average column on brands) so the brand detail screen can show
-- review history, not just a single number.

create table brand_ratings (
  id                 uuid        primary key default gen_random_uuid(),
  creator_id         uuid        not null references profiles(id) on delete cascade,
  brand_id           uuid        not null references brands(id) on delete cascade,
  deal_id            uuid        not null unique references deals(id) on delete cascade,
  rating             integer     not null check (rating between 1 and 5),
  paid_on_time       boolean,
  easy_to_work_with  boolean,
  revision_rounds    integer,
  would_work_again   boolean,
  notes              text,
  created_at         timestamptz not null default now()
);

alter table brand_ratings enable row level security;

create policy "brand_ratings: own rows"
  on brand_ratings for all using (auth.uid() = creator_id);


-- ── Tax & invoicing ────────────────────────────────────────────────────────
-- Brand contact details are snapshotted at generation time (not joined live)
-- so editing/deleting a brand later never changes a previously issued
-- invoice — standard invoicing practice.

create table invoices (
  id                   uuid        primary key default gen_random_uuid(),
  creator_id           uuid        not null references profiles(id) on delete cascade,
  deal_id              uuid        not null references deals(id) on delete restrict,
  invoice_number       text        not null,
  invoice_date         date        not null default current_date,
  brand_name           text        not null,
  brand_contact_person text,
  brand_contact_email  text,
  description          text        not null,
  amount               integer     not null,  -- whole INR rupees, pre-GST
  gst_applicable        boolean     not null default false,
  gst_rate              numeric     not null default 18,
  gst_amount             integer    not null default 0,
  total_amount           integer    not null,
  payment_due_date       date,
  tds_deducted            boolean   not null default false,
  tds_amount              integer,
  notes                   text,
  created_at              timestamptz not null default now(),
  unique (creator_id, invoice_number)
);

alter table invoices enable row level security;

create policy "invoices: own rows"
  on invoices for all using (auth.uid() = creator_id);


-- ── Shareable public creator profile card ─────────────────────────────────
-- A narrow, explicitly-opt-in public view. Only exposes what's needed for a
-- brand-facing media-kit-style card — never payment details, brand
-- contacts, or notes. The WHERE clause is the actual security boundary
-- (views run with the definer's privileges, bypassing RLS on the
-- underlying tables), so keep any future column additions here deliberate.

create view public_creator_profiles as
select
  p.public_share_slug,
  p.name,
  p.niche,
  p.follower_count,
  (select count(*) from deals d where d.creator_id = p.id and d.status = 'paid') as deals_completed,
  (select array_agg(distinct d.platform) from deals d where d.creator_id = p.id) as platforms
from profiles p
where p.public_profile_enabled = true and p.public_share_slug is not null;

grant select on public_creator_profiles to anon, authenticated;
