-- Three small tables that the dashboard needs and the product has never had:
-- somewhere for a creator to write in, a switch to turn a feature off without
-- a release, and a register of the data requests the DPDP Act obliges us to
-- service.
--
-- They are together because they share one shape: a creator may create a row
-- and read their own, an admin may do everything through the edge function,
-- and nobody may set the fields that decide how a row is treated.
--
-- ── The trick used three times below ────────────────────────────────────────
--
-- A creator inserting a row must not be able to choose its status, its
-- priority, or who it belongs to. RLS can refuse the insert but cannot
-- sanitise it, and a `with check` that pins every column turns into a wall of
-- conditions that has to be edited every time a column is added.
--
-- So each table has a before-insert trigger that overwrites those columns with
-- the values they are supposed to have. It fires only when the caller is a
-- signed-in creator: `auth.role()` is 'service_role' for the admin edge
-- function and null for a migration, and both of those are allowed to say what
-- they mean. It fails closed, because anything that is not recognisably the
-- server gets sanitised.


-- ── Support ─────────────────────────────────────────────────────────────────

create table if not exists support_tickets (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        references workspaces(id) on delete set null,
  user_id      uuid        references auth.users(id) on delete set null,
  -- Kept alongside user_id rather than joined for it. Somebody who writes in
  -- and then deletes their account still needs a reply, and by then the user
  -- row is gone.
  email        text,
  subject      text        not null,
  body         text        not null,
  status       text        not null default 'new'
               check (status in ('new', 'open', 'waiting', 'closed')),
  priority     text        not null default 'normal'
               check (priority in ('low', 'normal', 'high')),
  assigned_to  uuid        references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  closed_at    timestamptz
);

create index if not exists support_tickets_open_idx
  on support_tickets (status, created_at desc);
create index if not exists support_tickets_mine_idx
  on support_tickets (user_id, created_at desc);

-- The conversation on a ticket. Two kinds in one table, separated by a flag:
-- a reply the creator sees, and a note only admins see. One table because the
-- order they happened in is the thing that makes a thread readable, and two
-- tables cannot be ordered against each other without a union.
create table if not exists support_ticket_notes (
  id          uuid        primary key default gen_random_uuid(),
  ticket_id   uuid        not null references support_tickets(id) on delete cascade,
  author_id   uuid        references auth.users(id) on delete set null,
  -- true: nobody outside the dashboard ever sees this line.
  is_internal boolean     not null default false,
  body        text        not null,
  created_at  timestamptz not null default now()
);

create index if not exists support_ticket_notes_thread_idx
  on support_ticket_notes (ticket_id, created_at);

alter table support_tickets enable row level security;
alter table support_ticket_notes enable row level security;

create or replace function sanitise_support_ticket()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() = 'authenticated' then
    new.user_id   := auth.uid();
    new.status    := 'new';
    new.priority  := 'normal';
    new.assigned_to := null;
    new.closed_at := null;
    new.email     := (select email from auth.users where id = auth.uid());
  end if;
  new.created_at := coalesce(new.created_at, now());
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists sanitise_support_ticket_trg on support_tickets;
create trigger sanitise_support_ticket_trg
  before insert on support_tickets
  for each row execute function sanitise_support_ticket();

create or replace function sanitise_support_note()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() = 'authenticated' then
    new.author_id   := auth.uid();
    -- A creator cannot write an internal note, whatever they send. Otherwise
    -- "internal" would mean "internal unless somebody reads the API".
    new.is_internal := false;
  end if;
  return new;
end $$;

drop trigger if exists sanitise_support_note_trg on support_ticket_notes;
create trigger sanitise_support_note_trg
  before insert on support_ticket_notes
  for each row execute function sanitise_support_note();

-- A creator may raise a ticket and read their own. Not update one: changing
-- the subject of a ticket somebody is halfway through answering helps nobody,
-- and re-opening is what a reply is for.
drop policy if exists "support: raise your own" on support_tickets;
create policy "support: raise your own"
  on support_tickets for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "support: read your own" on support_tickets;
create policy "support: read your own"
  on support_tickets for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "support notes: read the replies on your own" on support_ticket_notes;
create policy "support notes: read the replies on your own"
  on support_ticket_notes for select
  to authenticated
  using (
    not is_internal
    and exists (
      select 1 from support_tickets t
      where t.id = support_ticket_notes.ticket_id and t.user_id = auth.uid()
    )
  );

drop policy if exists "support notes: reply to your own" on support_ticket_notes;
create policy "support notes: reply to your own"
  on support_ticket_notes for insert
  to authenticated
  with check (
    exists (
      select 1 from support_tickets t
      where t.id = support_ticket_notes.ticket_id and t.user_id = auth.uid()
    )
  );

revoke update, delete on support_tickets from anon, authenticated;
revoke update, delete on support_ticket_notes from anon, authenticated;


-- ── Feature switches ────────────────────────────────────────────────────────
--
-- The point of these is the bad evening: Meta changes something, Instagram
-- figures start returning nonsense, and the choice is between shipping a
-- release to every phone or leaving it broken. A switch makes it a checkbox.
--
-- Deliberately not per-user. A flag that can be on for some people and off for
-- others is an experiment framework, and this is a light switch.
create table if not exists feature_flags (
  key         text        primary key,
  label       text        not null,
  description text        not null,
  enabled     boolean     not null default true,
  updated_by  uuid        references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now()
);

alter table feature_flags enable row level security;

-- World readable, because the app and the website both have to obey them and
-- neither is signed in when it asks. Nothing here is secret: the flag says a
-- feature exists, and the feature is visible in the interface anyway.
drop policy if exists "flags: readable by everyone" on feature_flags;
create policy "flags: readable by everyone"
  on feature_flags for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on feature_flags from anon, authenticated;
grant select on feature_flags to anon, authenticated;

-- Seeded on, all of them, so that adding this table changes nothing about how
-- the product behaves today. A migration that quietly turns a feature off is
-- a migration nobody trusts.
insert into feature_flags (key, label, description) values
  ('instagram',   'Instagram figures',
   'The Connect Instagram button on the You screen. Turn off if Meta breaks or the app review lapses.'),
  ('youtube',     'YouTube figures',
   'The Connect YouTube button on the You screen. Turn off if the Google quota runs out.'),
  ('ai_capture',  'Capture from a screenshot',
   'Reading a deal out of a screenshot, a photograph or a voice note. Turn off if the AI bill needs stopping.'),
  ('sign_ups',    'New accounts',
   'Whether the sign-up page accepts anybody new. Turn off to hold the door during a problem.'),
  ('payments',    'Paid subscriptions',
   'The upgrade and checkout path. Turn off if Razorpay has a bad day, so nobody meets a broken payment page.')
on conflict (key) do nothing;


-- ── Data requests, under the DPDP Act ───────────────────────────────────────
--
-- A register, not a feature. As a data fiduciary we are obliged to service
-- access and erasure requests and to be able to show that we did. The product
-- can already export everything and delete an account; what has never existed
-- is a record that somebody asked and when they were answered.
create table if not exists data_requests (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id) on delete set null,
  workspace_id uuid        references workspaces(id) on delete set null,
  email        text,
  kind         text        not null check (kind in ('access', 'erasure')),
  status       text        not null default 'new'
               check (status in ('new', 'in_progress', 'done', 'refused')),
  note         text,
  created_at   timestamptz not null default now(),
  -- Thirty days from asking. Stored rather than computed so that the clock on
  -- a request does not move if the policy changes later.
  due_at       timestamptz not null default now() + interval '30 days',
  completed_at timestamptz
);

create index if not exists data_requests_open_idx
  on data_requests (status, due_at);

alter table data_requests enable row level security;

create or replace function sanitise_data_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() = 'authenticated' then
    new.user_id      := auth.uid();
    new.status       := 'new';
    new.completed_at := null;
    new.due_at       := now() + interval '30 days';
    new.email        := (select email from auth.users where id = auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists sanitise_data_request_trg on data_requests;
create trigger sanitise_data_request_trg
  before insert on data_requests
  for each row execute function sanitise_data_request();

drop policy if exists "data requests: make your own" on data_requests;
create policy "data requests: make your own"
  on data_requests for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "data requests: read your own" on data_requests;
create policy "data requests: read your own"
  on data_requests for select
  to authenticated
  using (user_id = auth.uid());

revoke update, delete on data_requests from anon, authenticated;

comment on table data_requests is
  'DPDP access and erasure requests. A creator may file one and read their own; only the admin dashboard may progress one.';


-- ── Who is waiting for whom ─────────────────────────────────────────────────
--
-- A support list is only useful if "open" means somebody here has to do
-- something. That falls out of who spoke last: a creator's reply puts the
-- ticket back on us, our reply puts it back on them.
--
-- In a trigger rather than in the edge function because a creator's reply does
-- not go through the edge function. It is written straight to the table under
-- RLS, so any rule that lives in the function only ever sees half the
-- conversation.
create or replace function bump_ticket_on_note()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner uuid;
begin
  -- Internal notes are us talking to ourselves and change nothing about who
  -- is waiting.
  if new.is_internal then
    return new;
  end if;

  select user_id into owner from support_tickets where id = new.ticket_id;

  update support_tickets
     set status = case
           when status = 'closed' then 'open'          -- a reply reopens it
           when new.author_id is not distinct from owner then 'open'
           else 'waiting'
         end,
         closed_at = null,
         updated_at = now()
   where id = new.ticket_id;

  return new;
end $$;

drop trigger if exists bump_ticket_on_note_trg on support_ticket_notes;
create trigger bump_ticket_on_note_trg
  after insert on support_ticket_notes
  for each row execute function bump_ticket_on_note();
