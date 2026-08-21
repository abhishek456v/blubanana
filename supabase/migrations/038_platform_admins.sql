-- Platform-level roles, for the admin dashboard.
--
-- A different axis from `memberships`. That table answers "what may this
-- manager see of Preeti's workspace"; this one answers "what may this person
-- see of the business". An admin is not a member of everybody's workspace and
-- must never become one, so the two cannot share a table.
--
-- ── The threat this is built against ────────────────────────────────────────
--
-- Not somebody discovering the URL. Every route is already readable in the
-- JavaScript the site ships to every visitor, so the address is public whether
-- we like it or not, and a design that leans on secrecy is a design that fails
-- the first time somebody opens the bundle.
--
-- The threat is a signed-in creator escalating themselves. So the row that
-- grants admin is written in a place no client can reach: `authenticated` and
-- `anon` have no privileges on this table at all, not even select. A crafted
-- "make me an admin" request is refused by Postgres before any policy runs and
-- before any application code has a chance to be wrong.
--
-- The app asks "what am I?" through `platform_role()`, a security definer
-- function that reads the table on the caller's behalf and returns a single
-- text value. It can answer that question and nothing else: it cannot list
-- other admins, and it cannot write.

create table if not exists platform_admins (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  -- admin   sees and does everything
  -- support tickets and impersonation, no revenue figures
  -- finance subscriptions and payments, no content
  -- editor  blog and media only, no customer data
  role       text        not null check (role in ('admin', 'support', 'finance', 'editor')),
  is_founder boolean     not null default false,
  invited_by uuid        references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Exactly one founder, enforced by the database rather than by remembering.
create unique index if not exists platform_admins_one_founder
  on platform_admins ((true)) where is_founder;

alter table platform_admins enable row level security;

-- No policies are declared on purpose.
--
-- RLS with no policy denies everything, which is the correct answer for every
-- client. Reads and writes happen through edge functions on the service role,
-- which bypasses RLS by design. Anything that reaches this table has already
-- proven it is the server.
revoke all on platform_admins from anon, authenticated;


-- ── The founder cannot be removed or demoted ────────────────────────────────
--
-- Including by another admin, and including by a compromised admin. The whole
-- point of being able to invite people is that inviting the wrong one is
-- survivable.
--
-- A trigger rather than a policy: policies are bypassed by the service role,
-- which is exactly what the admin edge functions run as, so a policy here
-- would protect against everything except the one caller that can reach the
-- table. Triggers fire for the service role too.
create or replace function protect_founder()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_founder then
      raise exception 'The founder cannot be removed';
    end if;
    return old;
  end if;

  if old.is_founder and (new.is_founder is distinct from true or new.role <> 'admin') then
    raise exception 'The founder cannot be demoted';
  end if;

  new.updated_at := now();
  return new;
end $$;

drop trigger if exists protect_founder_trg on platform_admins;
create trigger protect_founder_trg
  before update or delete on platform_admins
  for each row execute function protect_founder();


-- ── What the app is allowed to ask ──────────────────────────────────────────
--
-- One question, one answer: what am I? Returns null for everybody else, which
-- is what a creator reaching the admin URL gets, and is why that URL being
-- public costs nothing.
--
-- `security definer` so it can read a table the caller cannot, with the search
-- path pinned: without that, a caller can put their own `platform_admins` on
-- the path and have this read it instead.
create or replace function platform_role()
returns text
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select role from platform_admins where user_id = auth.uid();
$$;

revoke all on function platform_role() from public, anon;
grant execute on function platform_role() to authenticated;

comment on function platform_role() is
  'The caller''s platform role, or null. The only thing a client may ask of platform_admins.';


-- ── Seed the founder ────────────────────────────────────────────────────────
--
-- By email rather than by a pasted uuid, so this migration says who it means
-- and stays readable a year from now. Idempotent: re-running changes nothing.
insert into platform_admins (user_id, role, is_founder)
select id, 'admin', true from auth.users where email = 'abhishek456v@gmail.com'
on conflict (user_id) do nothing;
