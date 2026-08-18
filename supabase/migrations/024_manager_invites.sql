-- 024: The manager invite, and making the delete rule actually bite.
--
-- Two things, and the second is a live bug rather than a new feature.
--
-- ── The bug ──────────────────────────────────────────────────────────────────
--
-- 023 added, for each of eight tables:
--
--   create policy "deals: owner deletes only" on deals for delete
--     using (workspace_id in (select auth_owned_workspace_ids()));
--
-- and then verified its work by checking that a DELETE policy exists. One does.
-- It just does not do anything, because 010 had already installed:
--
--   create policy "deals: workspace members" on deals for all ...
--
-- Permissive policies are OR'd, and `for all` covers DELETE. So the row is
-- deletable if EITHER policy passes, and a manager passes the second one. 023
-- did not narrow the delete right, it added a redundant second way to have it.
-- The spec (§7) states this rule holds "even against a direct API call". Until
-- now it did not hold against any call at all.
--
-- The fix is one keyword: AS RESTRICTIVE. Restrictive policies are AND'd with
-- the permissive set instead of OR'd, which is the only way to subtract a right
-- that another policy grants. 023's policies are replaced rather than dropped
-- and re-added under a new name, so a database that already ran 023 converges
-- on the same state as one that never did.
--
-- ── The feature ──────────────────────────────────────────────────────────────
--
-- `memberships` cannot hold an invite: user_id is NOT NULL and references
-- profiles, so there is no row to write until the invitee has an account. The
-- invite therefore lives in its own table keyed by email, and is converted to a
-- membership by claim_pending_invites() once that account exists. The app calls
-- that on every launch, which covers both orders of events — invited then signs
-- up, or already has an account and is invited later — without a trigger on the
-- auth schema.
--
-- Safe to re-run.


-- ── 1. Invites ───────────────────────────────────────────────────────────────
-- The permission flags are copied onto the invite rather than referenced,
-- because the creator chooses them at invite time (§7) and they must survive
-- until the invitee accepts. Email is stored lowercased: the unique index is
-- what stops a second invite to the same person quietly overwriting the first.

create table if not exists workspace_invites (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  email        text        not null,
  role         text        not null default 'manager'
                 check (role in ('manager', 'editor', 'viewer')),
  status       text        not null default 'pending'
                 check (status in ('pending', 'accepted', 'revoked')),

  can_see_deals    boolean not null default true,
  can_see_brands   boolean not null default true,
  can_see_rates    boolean not null default false,
  can_see_invoices boolean not null default false,
  can_see_money    boolean not null default false,
  can_see_expenses boolean not null default false,
  can_see_banking  boolean not null default false,

  invited_by   uuid        not null references profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,

  -- An invite cannot make someone an owner. Owner is established by
  -- handle_new_user() at signup and is the one role with no path in.
  check (role <> 'owner')
);

create unique index if not exists workspace_invites_pending_unique
  on workspace_invites (workspace_id, lower(email))
  where status = 'pending';

create index if not exists workspace_invites_email_idx
  on workspace_invites (lower(email)) where status = 'pending';

-- Enabled but deliberately NOT forced, for the same reason memberships is not
-- (010): claim_pending_invites() has to read and update this table on behalf of
-- someone who is not yet a member of the workspace, and FORCE would apply RLS
-- to the function owner too, so the owner-only policy below would block the
-- very call that exists to get around it.
alter table workspace_invites enable row level security;

-- Owner-only, deliberately. The invitee never selects from this table: they
-- reach their invite through claim_pending_invites(), which is SECURITY
-- DEFINER. A policy letting anyone read invites addressed to their own email
-- would also hand them the workspace_id and the full permission set of a
-- workspace they have not joined yet.
drop policy if exists "workspace_invites: owner manages" on workspace_invites;
create policy "workspace_invites: owner manages"
  on workspace_invites for all to authenticated
  using (workspace_id in (select auth_owned_workspace_ids()))
  with check (workspace_id in (select auth_owned_workspace_ids()));


-- ── 2. Claiming ──────────────────────────────────────────────────────────────
-- Converts every pending invite addressed to the caller into an active
-- membership. Idempotent, and safe to call on every app launch.
--
-- The email comes from auth.users rather than auth.email(), which reads a JWT
-- claim minted at sign-in and so goes stale if the address changes mid-session.
--
-- ON CONFLICT means re-inviting an existing member updates their access rather
-- than failing on the (workspace_id, user_id) unique — which is exactly what a
-- creator changing her mind about what a manager can see would expect.

create or replace function claim_pending_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text;
  claimed      integer;
begin
  if auth.uid() is null then
    return 0;
  end if;

  select lower(email) into caller_email from auth.users where id = auth.uid();
  if caller_email is null then
    return 0;
  end if;

  with mine as (
    select * from workspace_invites
    where status = 'pending' and lower(email) = caller_email
  ), inserted as (
    insert into memberships (
      workspace_id, user_id, role, status,
      can_see_deals, can_see_brands, can_see_rates, can_see_invoices,
      can_see_money, can_see_expenses, can_see_banking
    )
    select
      mine.workspace_id, auth.uid(), mine.role, 'active',
      mine.can_see_deals, mine.can_see_brands, mine.can_see_rates,
      mine.can_see_invoices, mine.can_see_money, mine.can_see_expenses,
      mine.can_see_banking
    from mine
    on conflict (workspace_id, user_id) do update set
      role             = excluded.role,
      status           = 'active',
      can_see_deals    = excluded.can_see_deals,
      can_see_brands   = excluded.can_see_brands,
      can_see_rates    = excluded.can_see_rates,
      can_see_invoices = excluded.can_see_invoices,
      can_see_money    = excluded.can_see_money,
      can_see_expenses = excluded.can_see_expenses,
      can_see_banking  = excluded.can_see_banking,
      updated_at       = now()
    returning 1
  )
  update workspace_invites set status = 'accepted', accepted_at = now()
  where id in (select id from mine);

  get diagnostics claimed = row_count;
  return claimed;
end $$;

revoke all on function claim_pending_invites() from public;
grant execute on function claim_pending_invites() to authenticated;


-- ── 2b. Who is on the team ───────────────────────────────────────────────────
-- The team screen has to name the people it lists, and cannot.
-- `profiles` is "own row read", so the creator cannot read her own manager's
-- profile row, and email lives in auth.users which the client cannot query at
-- all. Both of those are correct and should stay that way.
--
-- So: a definer function that returns member emails for workspaces the caller
-- OWNS, and nothing else. The where-clause is the security boundary — a manager
-- calling this gets an empty set, because auth_owned_workspace_ids() is empty
-- for them.

create or replace function workspace_member_emails()
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, u.email::text
  from memberships m
  join auth.users u on u.id = m.user_id
  where m.workspace_id in (select auth_owned_workspace_ids())
$$;

revoke all on function workspace_member_emails() from public;
grant execute on function workspace_member_emails() to authenticated;


-- ── 3. Per-area access ───────────────────────────────────────────────────────
-- Mirrors auth_owned_workspace_ids(): SECURITY DEFINER so that reading
-- memberships from inside a policy does not re-enter that table's own policy
-- (the 42P17 trap 017 exists to document).
--
-- An unrecognised area name makes the CASE return null, so the row is excluded.
-- Fail closed: a typo in a policy hides data rather than exposing it.

create or replace function auth_workspace_ids_allowing(area text)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from memberships
  where user_id = auth.uid()
    and status = 'active'
    and (
      role = 'owner'
      or case area
           when 'deals'    then can_see_deals
           when 'brands'   then can_see_brands
           when 'rates'    then can_see_rates
           when 'invoices' then can_see_invoices
           when 'money'    then can_see_money
           when 'expenses' then can_see_expenses
           when 'banking'  then can_see_banking
         end
    )
$$;

revoke all on function auth_workspace_ids_allowing(text) from public;
grant execute on function auth_workspace_ids_allowing(text) to authenticated;


-- ── 4. The delete rule, this time enforced ───────────────────────────────────
-- AS RESTRICTIVE is the entire point. See the header.

do $$
declare
  target text;
begin
  foreach target in array array['deals', 'payments', 'invoices', 'brands', 'deal_stages',
                                'brand_contacts', 'expenses', 'deal_deliverables']
  loop
    -- invoice_line_items is absent from this list on purpose, and was in 023
    -- too: removing a line while editing a draft invoice is editing it, not
    -- destroying a record, and a manager with invoice access needs to.
    execute format('drop policy if exists %I on %I', target || ': owner deletes only', target);
    execute format(
      'create policy %I on %I as restrictive for delete to authenticated '
      || 'using (workspace_id in (select auth_owned_workspace_ids()))',
      target || ': owner deletes only', target
    );
  end loop;
end $$;


-- ── 5. Per-area read gates ───────────────────────────────────────────────────
-- Also restrictive, and for the same reason: 010's `for all` policy already
-- grants a member access to every one of these tables, so a permissive policy
-- here would widen that rather than narrow it.
--
-- The owner always passes, because auth_workspace_ids_allowing() returns her
-- workspace for every area regardless of the flags.
--
-- Not covered here, and deliberately:
--
--   can_see_rates   is a column on `deals`, not a table. RLS is row-level, so
--                   a manager who can see deals reads the row including `rate`.
--                   The masking is in the UI only. Making it a real boundary
--                   means a view or a column-restricted role, which is a
--                   larger change than this migration should carry.
--
--   can_see_banking needs no policy: bank details live on `profiles`, whose
--                   policy is "own row read". A manager cannot read the
--                   creator's profile row at all, so the flag only governs
--                   whether those fields render where the app already has
--                   them (invoice rendering).

do $$
declare
  spec text[][] := array[
    ['deals',             'deals'],
    ['deal_stages',       'deals'],
    ['deal_deliverables', 'deals'],
    ['brands',            'brands'],
    ['brand_contacts',    'brands'],
    ['payments',          'money'],
    ['invoices',          'invoices'],
    ['invoice_line_items', 'invoices'],
    ['expenses',          'expenses']
  ];
  i int;
  tbl text;
  area text;
begin
  for i in 1 .. array_length(spec, 1) loop
    tbl  := spec[i][1];
    area := spec[i][2];
    execute format('drop policy if exists %I on %I', tbl || ': area gate', tbl);
    execute format(
      'create policy %I on %I as restrictive to authenticated '
      || 'using (workspace_id in (select auth_workspace_ids_allowing(%L))) '
      || 'with check (workspace_id in (select auth_workspace_ids_allowing(%L)))',
      tbl || ': area gate', tbl, area, area
    );
  end loop;
end $$;


-- ── 6. Verification ──────────────────────────────────────────────────────────
-- Checks what 023's verification failed to: not that a delete policy exists,
-- but that it is restrictive. `permissive` is the text 'PERMISSIVE' or
-- 'RESTRICTIVE' in pg_policies.

do $$
declare
  bad text;
begin
  select string_agg(tablename, ', ') into bad
  from pg_policies
  where schemaname = 'public'
    and policyname like '%: owner deletes only'
    and permissive <> 'RESTRICTIVE';

  if bad is not null then
    raise exception 'Delete policy is still permissive on: %', bad;
  end if;

  select string_agg(t, ', ') into bad
  from unnest(array['deals','payments','invoices','brands','deal_stages',
                    'brand_contacts','expenses','deal_deliverables']) as t
  where not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = t
      and policyname = t || ': owner deletes only'
      and permissive = 'RESTRICTIVE'
  );

  if bad is not null then
    raise exception 'Restrictive delete policy missing on: %', bad;
  end if;

  if to_regclass('public.workspace_invites') is null then
    raise exception 'workspace_invites was not created';
  end if;

  raise notice 'OK. Invites are in place and the delete rule is now restrictive.';
end $$;
