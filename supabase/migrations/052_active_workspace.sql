-- 052: One workspace at a time.
--
-- ── What was wrong ───────────────────────────────────────────────────────────
--
-- Everybody who signs up gets a workspace of their own (handle_new_user). A
-- manager is somebody who is then also given a membership in a creator's
-- workspace. So a manager always belongs to two, and nothing anywhere said
-- which of the two she was working in.
--
-- Reads returned both at once, because every policy asks "is this row in any
-- workspace of mine". Writes went to whichever membership was older, which is
-- always her own, because the app took the earliest. Found by signing in as a
-- freshly invited manager on 15 Nov 2026:
--
--   * her own brand and the creator's eleven sat in one list;
--   * a deal she added for the creator would have been filed in her own
--     workspace, pointing at a brand in somebody else's;
--   * the trial banner counted the creator's deals against her own trial;
--   * the Team screen called her the creator, with the right to delete;
--   * none of the seven permission switches hid anything in the interface,
--     since the app looked her access up in her own workspace, where she is
--     the owner.
--
-- ── The fix ──────────────────────────────────────────────────────────────────
--
-- A person works in one workspace at a time, and the database is what knows
-- which. Every policy in the schema already goes through four helper
-- functions, so narrowing those four to the active workspace scopes every read
-- and every write at once, with no query in the app able to forget.
--
-- This only ever takes access away from a statement. Each helper returns a
-- subset of what it returned before: the same memberships, filtered to one
-- workspace. Somebody with a single membership, which is every account that
-- existed before this, gets exactly what she got yesterday.
--
-- Safe to re-run.


-- ── 1. Where the choice is kept ──────────────────────────────────────────────
-- On the profile, so it follows the person across devices: a manager who
-- switches on her laptop finds her phone in the same place. Null means "never
-- chose", which resolves to her own workspace below.
--
-- The profile's update policy lets her write this column to anything at all.
-- That is harmless, and deliberately not defended against here: the value is
-- never trusted on its own, only used when a live membership stands behind it.

alter table profiles
  add column if not exists active_workspace_id uuid references workspaces(id) on delete set null;


-- ── 2. Which workspace the caller is in ──────────────────────────────────────
-- The chosen one if she still belongs to it, otherwise the one she owns,
-- otherwise the oldest she was added to. The first fallback is what makes
-- removing a manager safe: the moment her membership goes, her stored choice
-- stops resolving and she is back in her own workspace on the next statement,
-- not looking at an empty app until she works out why.
--
-- SECURITY DEFINER for the reason auth_workspace_ids() is (017): it reads
-- memberships from inside the policies on memberships.

create or replace function auth_active_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select m.workspace_id
       from profiles p
       join memberships m
         on m.workspace_id = p.active_workspace_id
        and m.user_id = p.id
        and m.status = 'active'
      where p.id = auth.uid()),
    (select workspace_id from memberships
      where user_id = auth.uid() and status = 'active' and role = 'owner'
      order by created_at
      limit 1),
    (select workspace_id from memberships
      where user_id = auth.uid() and status = 'active'
      order by created_at
      limit 1)
  )
$$;

revoke all on function auth_active_workspace_id() from public, anon;
grant execute on function auth_active_workspace_id() to authenticated;


-- ── 3. The four helpers, narrowed ────────────────────────────────────────────
-- Same bodies as 017, 024 and 035, each with one more condition. Replaced in
-- place so the policies and the masking views that call them by name pick the
-- change up without being touched.

create or replace function auth_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from memberships
  where user_id = auth.uid() and status = 'active'
    and workspace_id = auth_active_workspace_id()
$$;

create or replace function auth_owned_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from memberships
  where user_id = auth.uid()
    and status = 'active'
    and role = 'owner'
    and workspace_id = auth_active_workspace_id()
$$;

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
    and workspace_id = auth_active_workspace_id()
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

create or replace function auth_writable_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.workspace_id
    from memberships m
    left join subscriptions s on s.workspace_id = m.workspace_id
   where m.user_id = auth.uid()
     and m.status = 'active'
     and m.workspace_id = auth_active_workspace_id()
     and (
       s.workspace_id is null
       or s.is_internal
       or (s.status = 'trialing' and s.trial_ends_at > now())
       or (s.status in ('active', 'past_due')
           and (s.current_period_end is null or s.current_period_end > now()))
     )
$$;


-- ── 4. Switching ─────────────────────────────────────────────────────────────
-- A function rather than a plain update, so asking for a workspace she is not
-- in is an error she is told about instead of a write that silently resolves
-- to somewhere else.

create or replace function set_active_workspace(p_workspace uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  if not exists (
    select 1 from memberships
     where user_id = auth.uid() and workspace_id = p_workspace and status = 'active'
  ) then
    raise exception 'You are not a member of that workspace' using errcode = '42501';
  end if;

  update profiles set active_workspace_id = p_workspace where id = auth.uid();
  return p_workspace;
end $$;

revoke all on function set_active_workspace(uuid) from public, anon;
grant execute on function set_active_workspace(uuid) to authenticated;


-- ── 5. The list to switch between ────────────────────────────────────────────
-- `workspaces` is now readable for the active one only, and a profile only by
-- its owner, so the switcher cannot name the other workspaces by itself. This
-- returns the caller's own memberships and nothing else: the where-clause is
-- the boundary. The creator's name is the one thing it reveals about a
-- workspace, to somebody she invited into it.

create or replace function my_workspaces()
returns table (
  workspace_id uuid,
  role         text,
  owner_name   text,
  is_active    boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select m.workspace_id,
         m.role,
         (select nullif(trim(p.name), '')
            from memberships o
            join profiles p on p.id = o.user_id
           where o.workspace_id = m.workspace_id and o.role = 'owner'
           order by o.created_at
           limit 1),
         m.workspace_id = auth_active_workspace_id()
    from memberships m
   where m.user_id = auth.uid() and m.status = 'active'
   order by (m.role = 'owner') desc, m.created_at
$$;

revoke all on function my_workspaces() from public, anon;
grant execute on function my_workspaces() to authenticated;


-- ── 6. Claiming an invite puts a new manager where she was invited ───────────
-- Somebody who signs up because she was invited has a workspace of her own
-- with nothing in it, and would otherwise open the app onto that: an empty
-- dashboard and a prompt to add her first deal, with the creator's work one
-- hidden switch away.
--
-- So an accepted invite becomes the active workspace, but only when she has
-- never put anything in her own. A creator with a working workspace who is
-- also invited to manage a friend's keeps opening the app on her own work, and
-- finds the other one in the switcher.
--
-- Otherwise unchanged from 024.

create or replace function claim_pending_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text;
  claimed      integer;
  joined       uuid;
begin
  if auth.uid() is null then
    return 0;
  end if;

  select lower(email) into caller_email from auth.users where id = auth.uid();
  if caller_email is null then
    return 0;
  end if;

  -- The newest invite is the one to land on if there are several.
  select workspace_id into joined
    from workspace_invites
   where status = 'pending' and lower(email) = caller_email
   order by created_at desc
   limit 1;

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

  if claimed > 0 and joined is not null and not exists (
    select 1
      from memberships own
     where own.user_id = auth.uid()
       and own.role = 'owner'
       and (
         exists (select 1 from deals    d where d.workspace_id = own.workspace_id)
         or exists (select 1 from brands   b where b.workspace_id = own.workspace_id)
         or exists (select 1 from invoices i where i.workspace_id = own.workspace_id)
         or exists (select 1 from expenses e where e.workspace_id = own.workspace_id)
       )
  ) then
    update profiles set active_workspace_id = joined where id = auth.uid();
  end if;

  return claimed;
end $$;

revoke all on function claim_pending_invites() from public;
grant execute on function claim_pending_invites() to authenticated;
