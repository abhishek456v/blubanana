-- ─────────────────────────────────────────────────────────────────────────────
-- Blubanana: Phase 1 schema
-- Run this once in the Supabase dashboard SQL editor (or via supabase db push).
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Tables ───────────────────────────────────────────────────────────────────

-- One profile per auth user. Created automatically by the trigger below.
create table profiles (
  id             uuid        primary key references auth.users(id) on delete cascade,
  name           text        not null default '',
  phone          text,
  follower_count integer,
  created_at     timestamptz not null default now()
);

-- Reusable client records (a brand can appear in many deals).
create table brands (
  id             uuid        primary key default gen_random_uuid(),
  creator_id     uuid        not null references profiles(id) on delete cascade,
  name           text        not null,
  contact_person text,
  contact_phone  text,
  contact_email  text,
  notes          text,
  created_at     timestamptz not null default now()
);

-- One deal = one content collaboration with one brand.
create table deals (
  id                       uuid        primary key default gen_random_uuid(),
  creator_id               uuid        not null references profiles(id) on delete cascade,
  brand_id                 uuid        not null references brands(id) on delete restrict,
  platform                 text        not null check (platform in (
                             'instagram_reel', 'instagram_feed',
                             'youtube_short',  'youtube_long',
                             'podcast', 'twitter', 'linkedin', 'other'
                           )),
  deliverable_description  text        not null,
  rate                     integer     not null,  -- whole INR rupees
  script_due_date          date,
  shoot_date               date,
  edit_done_date           date,
  publish_date             date,
  status                   text        not null default 'intake' check (status in (
                             'intake', 'script_due', 'shooting', 'editing',
                             'published', 'payment_awaited', 'paid'
                           )),
  live_link                text,
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- One payment record per deal (created when deal moves to payment_awaited).
create table payments (
  id             uuid        primary key default gen_random_uuid(),
  deal_id        uuid        not null unique references deals(id) on delete cascade,
  amount         integer     not null,  -- whole INR rupees
  payment_terms  text,                  -- e.g. "45 days from publish"
  due_date       date,
  status         text        not null default 'pending' check (status in (
                   'pending', 'reminder_sent', 'overdue', 'paid'
                 )),
  paid_date      date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);


-- ── Row Level Security ────────────────────────────────────────────────────────
-- Every user can only see and touch their own data.

alter table profiles enable row level security;
alter table brands   enable row level security;
alter table deals    enable row level security;
alter table payments enable row level security;

-- Profiles: read/update own row only (insert is handled by the trigger).
create policy "profiles: own row read"
  on profiles for select using (auth.uid() = id);

create policy "profiles: own row update"
  on profiles for update using (auth.uid() = id);

-- Brands, deals: full CRUD scoped to creator_id.
create policy "brands: own rows"
  on brands for all using (auth.uid() = creator_id);

create policy "deals: own rows"
  on deals for all using (auth.uid() = creator_id);

-- Payments: no creator_id column, so scope via the parent deal.
create policy "payments: own deals only"
  on payments for all using (
    exists (
      select 1 from deals
      where deals.id = payments.deal_id
        and deals.creator_id = auth.uid()
    )
  );


-- ── Trigger: auto-create profile on sign-up ───────────────────────────────────
-- Reads the `name` field from raw_user_meta_data, which is populated by
-- supabase.auth.signUp({ options: { data: { name: "..." } } }) in the app.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();


-- ── Trigger: keep updated_at current ─────────────────────────────────────────

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger deals_updated_at
  before update on deals
  for each row execute procedure set_updated_at();

create trigger payments_updated_at
  before update on payments
  for each row execute procedure set_updated_at();
