-- ─────────────────────────────────────────────────────────────────────────────
-- Blubanana: Phase 2, stage 1 of 3: workspaces (EXPAND).
-- Run this once in the Supabase dashboard SQL editor, after 008.
--
-- This stage is deliberately NON-BREAKING. It adds the workspace tables and a
-- nullable workspace_id to every business table, then backfills them. Existing
-- creator_id columns and creator_id-based RLS policies are left completely
-- untouched, so the app keeps working exactly as it does today while this sits
-- in place.
--
--   009 (this file)  EXPAND      add + backfill, nothing enforced
--   010              MIGRATE     NOT NULL, workspace-based RLS, forced RLS
--   011              CONTRACT    drop creator_id, once 010 has been live a while
--
-- Split this way because 010 rewrites every access-control policy against a
-- live database. If it goes wrong, the fix should be "run 010's down script",
-- not "restore last night's backup".
--
-- Safe to re-run.
--
--
-- A NOTE ON THE ISOLATION MECHANISM
--
-- The architecture spec calls for `SET LOCAL app.workspace_id` per transaction,
-- read from a JWT by a Node API. This app has no such API: the client talks to
-- PostgREST directly, and there is no server-side transaction to set that on.
--
-- The Supabase-native equivalent is a policy that resolves the caller's
-- workspaces from auth.uid() at query time. It gives the same guarantee (a
-- forgotten filter returns zero rows, and Postgres is what enforces it) without
-- inventing a backend tier that does not exist. If a Node API is introduced
-- later, these policies can gain a `SET LOCAL` branch without a data migration.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Preconditions ────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'deal_deliverables'
  ) then
    raise exception 'Migration 007 has not been applied. Run 007_deliverables_and_platforms.sql first.';
  end if;
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'invoice_line_items'
  ) then
    raise exception 'Migration 008 has not been applied. Run 008_invoice_line_items.sql first.';
  end if;
end $$;


-- ── Workspaces and membership ────────────────────────────────────────────────
-- The tenant is a workspace, not a user. On day one every workspace has exactly
-- one member and the product looks single-user, but the day a creator hires a
-- manager, or an agency wants three seats, no table changes shape.

create table if not exists workspaces (
  id            uuid        primary key default gen_random_uuid(),
  name          text        not null,
  type          text        not null default 'solo' check (type in ('solo', 'agency')),
  country_code  char(2)     not null default 'IN',
  base_currency char(3)     not null default 'INR',
  timezone      text        not null default 'Asia/Kolkata',
  -- Reminder scheduling respects these; stored per workspace so a future
  -- manager inherits the creator's working hours rather than their own.
  quiet_hours_start time    not null default '22:00',
  quiet_hours_end   time    not null default '08:00',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists memberships (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  user_id      uuid        not null references profiles(id) on delete cascade,
  role         text        not null default 'owner'
                 check (role in ('owner', 'manager', 'editor', 'viewer')),
  status       text        not null default 'active'
                 check (status in ('active', 'invited', 'suspended')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists memberships_user_idx
  on memberships (user_id) where status = 'active';

-- Exactly one owner per workspace while the product is solo-only.
create unique index if not exists memberships_one_owner
  on memberships (workspace_id) where role = 'owner';


-- ── The lookup every policy will use ─────────────────────────────────────────
-- SECURITY DEFINER so it can read memberships regardless of the policies on
-- memberships itself. Without this, a policy that queries memberships to
-- decide access to memberships recurses infinitely.
--
-- STABLE lets Postgres evaluate it once per query as an InitPlan rather than
-- once per row, which is the difference between a fast index scan and a
-- sequential scan on every read.

create or replace function auth_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from memberships
  where user_id = auth.uid() and status = 'active'
$$;

revoke all on function auth_workspace_ids() from public;
grant execute on function auth_workspace_ids() to authenticated;


-- ── Backfill: one workspace per existing creator ─────────────────────────────
-- Deterministic id (the creator's own uuid) so this is naturally idempotent and
-- so a workspace is easy to trace back to the creator it was created for.

insert into workspaces (id, name)
select p.id, coalesce(nullif(p.name, ''), 'My workspace')
from profiles p
where not exists (select 1 from workspaces w where w.id = p.id);

insert into memberships (workspace_id, user_id, role)
select p.id, p.id, 'owner'
from profiles p
where not exists (
  select 1 from memberships m where m.workspace_id = p.id and m.user_id = p.id
);


-- ── workspace_id on every business table ─────────────────────────────────────
-- Nullable for now. 010 makes it NOT NULL once the backfill below is verified.

alter table brands             add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table deals              add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table payments           add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table deal_deliverables  add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table brand_ratings      add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table invoices           add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table invoice_line_items add column if not exists workspace_id uuid references workspaces(id) on delete cascade;

-- Because the backfill maps workspace.id = creator_id, these are direct copies.
-- payments has no creator_id of its own and is scoped through its deal.
update brands             set workspace_id = creator_id where workspace_id is null;
update deals              set workspace_id = creator_id where workspace_id is null;
update deal_deliverables  set workspace_id = creator_id where workspace_id is null;
update brand_ratings      set workspace_id = creator_id where workspace_id is null;
update invoices           set workspace_id = creator_id where workspace_id is null;
update invoice_line_items set workspace_id = creator_id where workspace_id is null;

update payments p
   set workspace_id = d.creator_id
  from deals d
 where d.id = p.deal_id and p.workspace_id is null;


-- ── Indexes leading with workspace_id ────────────────────────────────────────
-- Every tenant-scoped query filters on this first, so it leads every index.
-- Created now rather than in 010 so the enforcing migration does no index
-- building on a table it is also rewriting policies for.

create index if not exists brands_workspace_idx             on brands (workspace_id);
create index if not exists deals_workspace_idx              on deals (workspace_id);
create index if not exists deals_workspace_status_idx       on deals (workspace_id, status);
create index if not exists payments_workspace_idx           on payments (workspace_id);
create index if not exists deal_deliverables_workspace_idx  on deal_deliverables (workspace_id, deal_id);
create index if not exists brand_ratings_workspace_idx      on brand_ratings (workspace_id);
create index if not exists invoices_workspace_idx           on invoices (workspace_id);
create index if not exists invoice_line_items_workspace_idx on invoice_line_items (workspace_id, invoice_id);


-- ── RLS on the new tables only ───────────────────────────────────────────────
-- Existing tables keep their creator_id policies untouched until 010.

alter table workspaces  enable row level security;
alter table memberships enable row level security;

drop policy if exists "workspaces: members can read" on workspaces;
create policy "workspaces: members can read"
  on workspaces for select
  using (id in (select auth_workspace_ids()));

drop policy if exists "workspaces: owner can update" on workspaces;
create policy "workspaces: owner can update"
  on workspaces for update
  using (exists (
    select 1 from memberships m
    where m.workspace_id = workspaces.id and m.user_id = auth.uid() and m.role = 'owner'
  ));

-- A user must be able to read their own membership rows to discover which
-- workspaces they belong to at all: that read is what bootstraps everything
-- else, so it cannot itself depend on knowing the workspace.
drop policy if exists "memberships: own or same workspace" on memberships;
create policy "memberships: own or same workspace"
  on memberships for select
  using (user_id = auth.uid() or workspace_id in (select auth_workspace_ids()));


-- ── New signups get a workspace ──────────────────────────────────────────────
-- Without this, anyone signing up between 009 and 010 lands with a profile and
-- no workspace, and every row they create would have a null workspace_id,
-- which 010 then refuses to make NOT NULL. Extends the existing
-- handle_new_user trigger rather than adding a second one, so profile,
-- workspace and membership are created in a single transaction.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := coalesce(new.raw_user_meta_data->>'name', '');
begin
  insert into profiles (id, name) values (new.id, v_name);

  -- Same deterministic id as the backfill above: workspace.id = user id.
  insert into workspaces (id, name)
  values (new.id, coalesce(nullif(v_name, ''), 'My workspace'))
  on conflict (id) do nothing;

  insert into memberships (workspace_id, user_id, role)
  values (new.id, new.id, 'owner')
  on conflict (workspace_id, user_id) do nothing;

  return new;
end;
$$;


-- ── Verification ─────────────────────────────────────────────────────────────
-- Every row must have a workspace before 010 can enforce NOT NULL. Failing here
-- is far better than failing halfway through the enforcing migration.

do $$
declare
  orphans integer;
begin
  select
    (select count(*) from brands             where workspace_id is null)
  + (select count(*) from deals              where workspace_id is null)
  + (select count(*) from payments           where workspace_id is null)
  + (select count(*) from deal_deliverables  where workspace_id is null)
  + (select count(*) from brand_ratings      where workspace_id is null)
  + (select count(*) from invoices           where workspace_id is null)
  + (select count(*) from invoice_line_items where workspace_id is null)
  into orphans;

  if orphans > 0 then
    raise exception
      'Backfill incomplete: % row(s) still have no workspace_id. Do NOT run 010 until this is resolved.', orphans;
  end if;

  raise notice 'Workspace backfill complete. % workspace(s), % membership(s).',
    (select count(*) from workspaces), (select count(*) from memberships);
end $$;
