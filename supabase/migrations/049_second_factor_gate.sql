-- Has this person actually set up a second step?
--
-- ── Why the server needs to ask ─────────────────────────────────────────────
--
-- Enrolling a phone made the *app* ask for a code. It did not make the admin
-- endpoint ask for anything. Somebody holding a stolen admin password could
-- skip the app, sign in against the auth API directly, and call the endpoint
-- with the aal1 token they got back: every screen in the dashboard readable,
-- and the phone in the admin's pocket never rings.
--
-- That makes two-step verification a thing the interface does rather than a
-- thing that is true, which is the same as not having it.
--
-- ── Why a function rather than an SDK call ──────────────────────────────────
--
-- The obvious way is to ask the auth admin API from inside the edge function.
-- Two attempts at that returned 500s from method surfaces that turned out not
-- to exist on a service role client, and an endpoint that always fails is
-- worse than the hole it was closing. This is one line of SQL against the
-- table that holds the answer, and it can be tested on its own.
--
-- `auth.mfa_factors` is not reachable through PostgREST, so this is the only
-- way to read it from a function. Security definer, executable by the server
-- and nobody else, and the search path is pinned.

create or replace function has_verified_second_factor(uid uuid)
returns boolean
language sql
security definer
set search_path = auth, pg_temp
stable
as $$
  select exists (
    select 1 from auth.mfa_factors
    where user_id = uid and status = 'verified'
  )
$$;

revoke all on function has_verified_second_factor(uuid) from public, anon, authenticated;
grant execute on function has_verified_second_factor(uuid) to service_role;

comment on function has_verified_second_factor(uuid) is
  'Whether this user has finished setting up a second step. Service role only: it answers about anybody.';
