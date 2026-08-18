-- 034: Let a creator correct the annual report with what the app never saw.
--
-- §8.13: "Creators need to adjust figures their app never saw, so the report is
-- editable before export." The app knows the money that passed through it. It
-- does not know AdSense, affiliate income, a barter deal, an expense paid in
-- cash, or the TDS entries sitting in her Form 26AS from a brand that never
-- invoiced through here.
--
-- Reporting only what it knows, as though that were the whole year, is exactly
-- the failure §8.13 calls out about turnover-versus-income: a number that looks
-- authoritative and is wrong is worse than one that admits its own edges.
--
-- ── Adjustments, not overwrites ─────────────────────────────────────────────
--
-- Deliberately additive columns rather than editable copies of the computed
-- totals. The report shows both sides — what came from her deals, and what she
-- added — so she and her accountant can always see which is which. An editable
-- total would let a typo silently replace a figure the app can prove, and
-- neither of them would ever know it had.
--
-- One row per workspace per financial year: these are facts about a year, and
-- she will refine them over months as documents arrive.
--
-- Safe to re-run.

create table if not exists annual_report_adjustments (
  id             uuid        primary key default gen_random_uuid(),
  workspace_id   uuid        not null references workspaces(id) on delete cascade,
  -- 2026 means FY 2026-27 (April 2026 → March 2027), matching
  -- currentFinancialYearStart() in lib/annualReport.ts.
  fy_start_year  integer     not null,

  -- All whole rupees, like every other money value here (see types/index.ts).
  other_income   integer     not null default 0,
  other_expenses integer     not null default 0,
  other_tds      integer     not null default 0,
  other_gst      integer     not null default 0,

  -- What the adjustment is for. This is the line her accountant reads first,
  -- and a number with no explanation is one she will not remember in January.
  note           text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (workspace_id, fy_start_year)
);

-- Negative adjustments are allowed on purpose: a refunded deal or a
-- double-counted payment is a real correction downward. Nothing here is
-- constrained to positive.

create index if not exists annual_report_adjustments_year_idx
  on annual_report_adjustments (workspace_id, fy_start_year);

alter table annual_report_adjustments enable row level security;

-- Gated on the money area rather than plain membership: these figures are the
-- creator's total income for the year, which is exactly what `can_see_money`
-- exists to withhold from a production assistant (§7).
drop policy if exists "annual_report_adjustments: money area" on annual_report_adjustments;
create policy "annual_report_adjustments: money area"
  on annual_report_adjustments for all to authenticated
  using (workspace_id in (select auth_workspace_ids_allowing('money')))
  with check (workspace_id in (select auth_workspace_ids_allowing('money')));

-- The delete rule from 024 applies here too: a manager may correct the report
-- but may not destroy a year's corrections.
drop policy if exists "annual_report_adjustments: owner deletes only"
  on annual_report_adjustments;
create policy "annual_report_adjustments: owner deletes only"
  on annual_report_adjustments as restrictive for delete to authenticated
  using (workspace_id in (select auth_owned_workspace_ids()));


-- ── Verification ────────────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.annual_report_adjustments') is null then
    raise exception 'annual_report_adjustments was not created';
  end if;

  -- The delete restriction must be RESTRICTIVE, or it merely adds a second way
  -- to delete rather than removing the first. That was 023's mistake and 024's
  -- correction; a new table must not reintroduce it.
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'annual_report_adjustments'
       and policyname = 'annual_report_adjustments: owner deletes only'
       and permissive = 'RESTRICTIVE'
  ) then
    raise exception 'The delete policy is not restrictive, so it does not restrict anything';
  end if;

  raise notice 'OK. The annual report can be corrected.';
end $$;
