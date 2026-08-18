-- 035: Subscriptions, the trial, and the read-only state (PRODUCT.md §3).
--
-- ── The rules, and where each one lives ─────────────────────────────────────
--
-- §3 is specific, and the specifics matter more than the schema:
--
--   * 14 days, and always the full 14. Creating deals does not shorten it.
--   * At most 10 deals during the trial. Everything else is unlimited.
--   * Hitting the deal limit does NOT end the trial. She keeps every other
--     feature for the remaining days.
--   * After the trial the workspace goes READ-ONLY, not locked: all her data
--     stays visible, and the only two offers are "buy a plan" and "export my
--     data". Locking a creator out of her own records is hostile, and it makes
--     the export she is legally entitled to (§8.18, DPDP) impossible.
--
-- The gate is enforced here rather than in the app. A subscription check that
-- lives only in the UI is a subscription check that a determined caller skips,
-- and unlike most such gaps this one has a direct revenue cost.
--
-- ── Why read-only is a policy and not a flag ────────────────────────────────
--
-- Every business table already carries `workspace_id ... on delete cascade` and
-- a permissive workspace policy. Adding a RESTRICTIVE policy for INSERT and
-- UPDATE is what turns "expired" into a state the database understands: reads
-- keep working exactly as before, writes stop. DELETE is left to 024's owner
-- rule — an expired creator deleting her own data is not something to block.
--
-- Safe to re-run.


-- ── 1. Pricing ──────────────────────────────────────────────────────────────
-- One plan, every feature, five seats. Kept as a single configurable row
-- rather than constants in the app: changing a price should not need a release,
-- and the four displayed figures (monthly, 3/6/9-month, yearly, and each of
-- their struck-through list prices) all have to derive from the same base or
-- they will disagree with each other the first time one is edited.
--
-- PAISE, and the only place in this schema that is. Every other money value is
-- a whole number of rupees on purpose (see the note at the top of
-- types/index.ts) — but that rule is about the creator's money, and this is
-- ours. Razorpay's API takes paise, and converting at the boundary is how a
-- ₹999 charge becomes ₹9.99 the one time someone forgets. The column names
-- carry the unit so they cannot be misread.

create table if not exists pricing (
  -- Single row, enforced. A second row would mean two truths about the price.
  id                      boolean     primary key default true check (id),

  list_monthly_paise      integer     not null default 199900,
  /** Yearly is the only term that is discounted; 3/6/9 months bill at the monthly rate. */
  yearly_discount_percent integer     not null default 20
                            check (yearly_discount_percent between 0 and 90),

  /**
   * The launch offer, and its end.
   *
   * A struck-through price nobody is ever charged is a fabricated reference
   * price, which India's CCPA dark-pattern guidelines (2023) treat as a
   * misleading advertisement. The limit is what makes the anchor honest: once
   * 500 creators have subscribed, the intro genuinely stops and ₹1,999 is
   * genuinely the price.
   */
  intro_discount_percent  integer     not null default 50
                            check (intro_discount_percent between 0 and 90),
  intro_customer_limit    integer     not null default 500,

  /** Team invites are included. Capped so one agency cannot run thirty
   *  creators through a single subscription; raised on request. */
  seats                   integer     not null default 5,

  updated_at              timestamptz not null default now()
);

insert into pricing (id) values (true) on conflict (id) do nothing;

grant select on pricing to authenticated, anon;


-- ── 1b. Terms ───────────────────────────────────────────────────────────────
-- Months, and the multiplier applied to the monthly rate for the whole term.
-- 3, 6 and 9 months bill at the plain monthly rate: they exist for the
-- creator who would rather not think about it again for a while, and for our
-- cash flow, not as a discount ladder.

create table if not exists billing_terms (
  key             text    primary key check (key in ('monthly', 'quarterly', 'half_yearly', 'nine_month', 'yearly')),
  label           text    not null,
  months          integer not null,
  /** Multiplied by the monthly rate. Below `months` only where discounted. */
  term_multiplier numeric(4,2) not null,
  sort_order      integer not null
);

insert into billing_terms (key, label, months, term_multiplier, sort_order) values
  ('monthly',     'Monthly',   1,  1.00, 0),
  ('quarterly',   '3 months',  3,  3.00, 1),
  ('half_yearly', '6 months',  6,  6.00, 2),
  ('nine_month',  '9 months',  9,  9.00, 3),
  ('yearly',      '12 months', 12, 9.60, 4)
on conflict (key) do update
  set label = excluded.label,
      months = excluded.months,
      term_multiplier = excluded.term_multiplier,
      sort_order = excluded.sort_order;

grant select on billing_terms to authenticated, anon;


-- ── 1c. The one place a price is computed ───────────────────────────────────
-- Order of operations, and it is not incidental.
--
-- The discount applies to the MONTHLY rate first; the term multiplier applies
-- to the discounted monthly rate. Halving the term price instead gives ₹1,000
-- for a month (50% of ₹1,999 is ₹999.50) and ₹2,998 for three months, when
-- three months is defined as three times the monthly rate — ₹2,997. Two
-- displayed prices that disagree by a rupee is the kind of thing a customer
-- screenshots.
--
-- Rounded DOWN to the rupee: a price that rounds up past the advertised figure
-- is a price the advertisement got wrong.

create or replace function monthly_rate_paise(apply_intro boolean)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when apply_intro then floor(p.list_monthly_paise * (1 - p.intro_discount_percent / 100.0) / 100)::integer * 100
    else p.list_monthly_paise
  end
  from pricing p where p.id
$$;

create or replace function term_price_paise(term_key text, apply_intro boolean)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select floor(monthly_rate_paise(apply_intro) * t.term_multiplier / 100)::integer * 100
    from billing_terms t where t.key = term_key
$$;

revoke all on function monthly_rate_paise(boolean) from public;
revoke all on function term_price_paise(text, boolean) from public;
grant execute on function monthly_rate_paise(boolean) to authenticated, anon;
grant execute on function term_price_paise(text, boolean) to authenticated, anon;


-- ── 2. Subscriptions ────────────────────────────────────────────────────────
-- One row per workspace, created at signup in the trial state.

create table if not exists subscriptions (
  workspace_id     uuid        primary key references workspaces(id) on delete cascade,

  status           text        not null default 'trialing'
                     check (status in ('trialing', 'active', 'past_due', 'expired', 'cancelled')),

  trial_ends_at    timestamptz not null default now() + interval '14 days',
  -- Null while trialing. Set when a payment succeeds, and what the read-only
  -- gate actually reads: a subscription is current if now() is before this.
  current_period_end timestamptz,

  billing_term     text        references billing_terms(key),

  /**
   * Whether the launch discount was applied to the term she bought.
   *
   * Per term, not per customer. §3 as decided: the price holds for the term
   * purchased, and renewal takes whatever price is current then — so a yearly
   * subscriber keeps ₹9,590 for twelve months and sees the revised price when
   * she renews. This flag is also what `intro_seats_taken()` counts, which
   * makes "first 500" a fact rather than a marketing line.
   */
  intro_applied    boolean     not null default false,
  -- What she actually agreed to pay for this term, in paise, snapshotted at
  -- purchase. Held rather than recomputed because `pricing` will change and a
  -- past term must not silently reprice itself in the records.
  agreed_term_paise integer,

  -- Razorpay's ids. Null until a real subscription exists; the whole billing
  -- integration slots in here without touching anything above.
  razorpay_customer_id     text,
  razorpay_subscription_id text,

  /**
   * Never gated, never billed, and not counted toward the 500 launch places.
   *
   * For the founders' own workspaces and, later, anything support comps. An
   * explicit column rather than the trick of setting status='active' with a
   * null period end: a future admin panel has to be able to tell an internal
   * account from a paying customer at a glance, and revenue reporting has to
   * exclude these rather than quietly counting them.
   */
  is_internal      boolean     not null default false,

  cancelled_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table subscriptions enable row level security;

-- Readable by every member: the trial banner and the read-only prompt have to
-- render for a manager too, or they see a frozen app with no explanation.
drop policy if exists "subscriptions: workspace members read" on subscriptions;
create policy "subscriptions: workspace members read"
  on subscriptions for select to authenticated
  using (workspace_id in (select auth_workspace_ids()));

-- Nobody writes this from the client. Status changes come from Razorpay's
-- webhook through the service role; a client that could set its own status to
-- 'active' would make the entire gate decorative.
revoke insert, update, delete on subscriptions from authenticated;


-- ── 2b. Is the intro still running? ─────────────────────────────────────────
-- Defined AFTER `subscriptions`, and that is not cosmetic: Postgres validates a
-- SQL function body when the function is created, so referencing the table from
-- section 1 fails with "relation subscriptions does not exist". The first run of
-- this migration did exactly that.
--
-- Counts subscriptions that were actually paid for, not signups: a trialing
-- workspace has not taken one of the 500 places, and neither has a comped one.

create or replace function intro_seats_taken()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from subscriptions
   where intro_applied and not is_internal
     and status in ('active', 'past_due', 'cancelled')
$$;

revoke all on function intro_seats_taken() from public;
grant execute on function intro_seats_taken() to authenticated, anon;

create or replace function intro_is_live()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select intro_seats_taken() < (select intro_customer_limit from pricing where id)
$$;

revoke all on function intro_is_live() from public;
grant execute on function intro_is_live() to authenticated, anon;


-- ── 3. Is this workspace allowed to write? ──────────────────────────────────
-- SECURITY DEFINER and STABLE, mirroring auth_workspace_ids(): it is called
-- from a policy on nearly every table, so Postgres must be able to hoist it to
-- an InitPlan and evaluate it once per query rather than once per row.
--
-- Fails OPEN when no subscription row exists. A workspace created before this
-- migration, or by a path that skipped the trigger, must not find itself
-- read-only because of our bookkeeping.

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
     and (
       s.workspace_id is null
       or s.is_internal
       or (s.status = 'trialing' and s.trial_ends_at > now())
       or (s.status in ('active', 'past_due')
           and (s.current_period_end is null or s.current_period_end > now()))
     )
$$;

revoke all on function auth_writable_workspace_ids() from public;
grant execute on function auth_writable_workspace_ids() to authenticated;


-- ── 4. The read-only gate ───────────────────────────────────────────────────
-- RESTRICTIVE, for INSERT and UPDATE only. Reads are untouched — that is the
-- whole point of read-only rather than locked — and DELETE stays with 024's
-- owner rule.
--
-- `reminders`, `outbound_messages` and `push_tokens` are deliberately absent,
-- and not for the reason it first appears. The sender runs with the service
-- role and bypasses RLS entirely, so marking a reminder sent was never at risk.
--
-- The risk is the other direction: an expired creator still RECEIVES reminders,
-- and if her writes were gated she could not answer one. She would be nudged
-- about a deadline every day with no way to mark it done — nagging a person who
-- has already stopped paying, which is both useless and the worst possible last
-- impression of the product.
--
-- Whether we keep notifying her at all is a separate question, and the answer
-- is a grace window in the sender rather than a policy here. See
-- send-due-reminders.

do $$
declare
  target text;
begin
  foreach target in array array['deals', 'payments', 'invoices', 'invoice_line_items',
                                'brands', 'brand_contacts', 'deal_stages',
                                'deal_deliverables', 'expenses', 'brand_ratings']
  loop
    execute format('drop policy if exists %I on %I', target || ': subscription required', target);
    execute format(
      'create policy %I on %I as restrictive for insert to authenticated '
      || 'with check (workspace_id in (select auth_writable_workspace_ids()))',
      target || ': subscription required', target
    );

    execute format('drop policy if exists %I on %I', target || ': subscription required (update)', target);
    execute format(
      'create policy %I on %I as restrictive for update to authenticated '
      || 'using (workspace_id in (select auth_writable_workspace_ids()))',
      target || ': subscription required (update)', target
    );
  end loop;
end $$;


-- ── 5. The trial deal limit ─────────────────────────────────────────────────
-- A trigger rather than a policy, because the rule counts rows rather than
-- inspecting one. §3 is explicit that hitting the limit does NOT end the
-- trial — everything else stays available — so this refuses one insert and
-- changes no state.

create or replace function enforce_trial_deal_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  trial_limit constant integer := 10;
  is_trialing boolean;
  existing    integer;
begin
  select status = 'trialing' and trial_ends_at > now() and not is_internal
    into is_trialing
    from subscriptions
   where workspace_id = new.workspace_id;

  if not coalesce(is_trialing, false) then
    return new;
  end if;

  select count(*) into existing from deals where workspace_id = new.workspace_id;

  if existing >= trial_limit then
    raise exception 'Trial workspaces are limited to % deals', trial_limit
      using errcode = 'check_violation',
            hint = 'trial_deal_limit';
  end if;

  return new;
end $$;

drop trigger if exists deals_trial_limit on deals;
create trigger deals_trial_limit
  before insert on deals
  for each row execute function enforce_trial_deal_limit();


-- ── 6. Start the trial at signup ────────────────────────────────────────────
-- Extends 009's trigger rather than adding a second one on auth.users: two
-- triggers on the same event have no defined order, and this one needs the
-- workspace to exist first.

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

  insert into workspaces (id, name)
  values (new.id, coalesce(nullif(v_name, ''), 'My workspace'))
  on conflict (id) do nothing;

  insert into memberships (workspace_id, user_id, role)
  values (new.id, new.id, 'owner')
  on conflict (workspace_id, user_id) do nothing;

  -- §3: 14 days, and always the full 14.
  insert into subscriptions (workspace_id) values (new.id)
  on conflict (workspace_id) do nothing;

  return new;
end;
$$;


-- ── 7. Existing workspaces ──────────────────────────────────────────────────
-- Everyone already here gets a trial starting now rather than a backdated one
-- that expires the moment this runs.

insert into subscriptions (workspace_id)
select id from workspaces
on conflict (workspace_id) do nothing;


-- ── 7b. The founder's own workspaces ────────────────────────────────────────
-- Comped so the trial clock never starts on the account the product is built
-- and demonstrated from. Matched by email rather than by a pasted uuid: ids are
-- opaque, and a hardcoded one is impossible to check by reading.
--
-- Temporary by design. This belongs in an admin panel, and this block should be
-- deleted the day one exists — a list of comped accounts maintained in
-- migration files is a list nobody can see.

do $$
declare
  marked integer;
begin
  update subscriptions s
     set is_internal = true, status = 'active', updated_at = now()
    from memberships m
    join auth.users u on u.id = m.user_id
   where m.workspace_id = s.workspace_id
     and m.role = 'owner'
     and lower(u.email) in ('abhishek456v@gmail.com');

  get diagnostics marked = row_count;
  raise notice 'Marked % workspace(s) internal.', marked;
end $$;


-- ── 8. Verification ─────────────────────────────────────────────────────────

do $$
declare
  missing text;
  bad     text;
begin
  if (select count(*) from pricing) <> 1 then
    raise exception 'pricing must hold exactly one row';
  end if;

  if (select count(*) from billing_terms) <> 5 then
    raise exception 'All five billing terms should be present';
  end if;

  -- The yearly multiplier has to match the stated discount, or the page says
  -- 20% off and the charge says something else.
  if (select term_multiplier from billing_terms where key = 'yearly')
     <> round(12 * (1 - (select yearly_discount_percent from pricing where id) / 100.0), 2) then
    raise exception 'The yearly multiplier and the stated yearly discount disagree';
  end if;

  select string_agg(id::text, ', ') into missing
    from workspaces w
   where not exists (select 1 from subscriptions s where s.workspace_id = w.id);

  if missing is not null then
    raise exception 'Workspaces with no subscription row: %', missing;
  end if;

  -- Permissive would widen the write right rather than narrow it, which is
  -- 023's mistake. Every gate policy must be restrictive.
  select string_agg(distinct tablename, ', ') into bad
    from pg_policies
   where schemaname = 'public'
     and policyname like '%: subscription required%'
     and permissive <> 'RESTRICTIVE';

  if bad is not null then
    raise exception 'Subscription gate is permissive on: %', bad;
  end if;

  -- Reads must be untouched: a SELECT policy here would break the read-only
  -- state that §3 exists to guarantee.
  if exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and policyname like '%: subscription required%'
       and cmd in ('SELECT', 'ALL')
  ) then
    raise exception 'The subscription gate must not touch reads';
  end if;

  -- The four numbers on the pricing page, asserted rather than assumed.
  if monthly_rate_paise(true) <> 99900 then
    raise exception 'Intro monthly should be ₹999, got ₹%', monthly_rate_paise(true) / 100;
  end if;
  if term_price_paise('quarterly', true) <> 299700 then
    raise exception 'Intro 3-month should be ₹2,997, got ₹%', term_price_paise('quarterly', true) / 100;
  end if;
  if term_price_paise('yearly', true) <> 959000 then
    raise exception 'Intro yearly should be ₹9,590, got ₹%', term_price_paise('yearly', true) / 100;
  end if;
  if term_price_paise('yearly', false) <> 1919000 then
    raise exception 'List yearly should be ₹19,190, got ₹%', term_price_paise('yearly', false) / 100;
  end if;

  raise notice 'OK. Trials start at signup, and an expired workspace is read-only.';
end $$;
