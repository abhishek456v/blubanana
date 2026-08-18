-- 037: let the marketing site read the price list
--
-- Migration 035 granted `select on pricing to anon` so that a public page could
-- show the real price rather than a number typed into a marketing site. That
-- grant is not sufficient: row-level security is on for these tables, and with
-- no policy naming `anon`, every row is filtered out. The request succeeds and
-- returns `[]`, which is the worst shape a failure can take — no error, no log,
-- just a page that quietly falls back to whatever was hardcoded.
--
-- This is the same class of defect as the one 025 corrected on the other side:
-- a privilege change that reads as effective and is not. A grant answers "may
-- this role touch the table"; a policy answers "which rows does it see". Both
-- have to say yes.
--
-- What is being exposed is the published price list and nothing else. It is
-- already visible to anyone who opens the app's plan screen, and it has to be
-- visible on a pricing page. `subscriptions` — who pays, how much, and when —
-- is untouched and stays members-only.

begin;

-- ── 1. The two public tables ────────────────────────────────────────────────
-- Enabled explicitly rather than assumed. If RLS were off, a `create policy`
-- would sit there doing nothing and this migration would report success while
-- the table stayed wide open to any future grant.

alter table pricing       enable row level security;
alter table billing_terms enable row level security;

drop policy if exists "pricing: public read"       on pricing;
drop policy if exists "billing_terms: public read" on billing_terms;

create policy "pricing: public read"
  on pricing for select
  to anon, authenticated
  using (true);

create policy "billing_terms: public read"
  on billing_terms for select
  to anon, authenticated
  using (true);

-- Writes stay with the service role. Neither policy covers insert, update or
-- delete, and RLS denies what no policy permits — so the price list can be read
-- by the world and changed by nobody outside a migration or an admin tool.
revoke insert, update, delete on pricing       from anon, authenticated;
revoke insert, update, delete on billing_terms from anon, authenticated;


-- ── 2. Verify what actually matters ─────────────────────────────────────────
-- Not "does a policy exist" — that is the paperwork. The property under test is
-- "can the anonymous role read the price", which is the thing that was broken
-- while the paperwork looked complete.

do $$
declare
  price_rows integer;
  term_rows  integer;
  sub_rows   integer;
begin
  set local role anon;

  select count(*) into price_rows from pricing;
  select count(*) into term_rows  from billing_terms;

  -- And the boundary this must not have moved: anon still sees no subscriber.
  select count(*) into sub_rows from subscriptions;

  reset role;

  if price_rows < 1 then
    raise exception 'anon still cannot read pricing (% rows)', price_rows;
  end if;

  if term_rows < 5 then
    raise exception 'anon sees % billing terms, expected all 5', term_rows;
  end if;

  if sub_rows <> 0 then
    raise exception 'anon can now see % subscription row(s) — this migration widened the wrong thing', sub_rows;
  end if;

  raise notice 'anon reads % pricing row and % terms, and no subscriptions.', price_rows, term_rows;
end $$;

commit;
