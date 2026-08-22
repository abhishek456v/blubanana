-- ─────────────────────────────────────────────────────────────────────────────
-- Blubanana: typed deliverables, and a corrected platform list.
-- Run this once in the Supabase dashboard SQL editor, after 006.
--
-- Two changes:
--
-- 1. A deal stops being "one deliverable described in a text field" and
--    becomes a list of typed items. A single collaboration is normally a reel
--    *and* three stories *and* an auto-DM setup, each with its own due date,
--    its own rate and its own performance numbers, none of which fits in
--    `deals.deliverable_description`.
--
--    Ad rights become one of those item types rather than five columns bolted
--    onto `deals`, so "what did I sell them?" has exactly one answer.
--
-- 2. `podcast` is removed as a platform. Podcasts are published on YouTube or
--    Instagram; the category was never a destination of its own.
--
-- Deliberately NOT done here: `deals.rate` is not recomputed by a trigger from
-- the deliverable rates. Money columns should not be rewritten by something
-- invisible at the call site; `lib/deliverables.ts` recalculates and writes
-- the deal total explicitly whenever deliverables change.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Preconditions ────────────────────────────────────────────────────────────
-- This migration reads columns added by 005 and 006. Without this guard a
-- missing prerequisite surfaces 120 lines later as `column d.performance_views
-- does not exist`, which says nothing about the actual problem.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'deals' and column_name = 'ad_rights_granted'
  ) then
    raise exception 'Migration 005 (ad rights) has not been applied. Run 005_ad_rights.sql first.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'deals' and column_name = 'performance_views'
  ) then
    raise exception 'Migration 006 (phase 2/3) has not been applied. Run 006_phase2_phase3.sql first.';
  end if;
end $$;


-- ── Deliverables ─────────────────────────────────────────────────────────────
-- Everything below is written to be safe to re-run: a migration that fails
-- halfway should be fixable by running it again, not by hand-unpicking state.

create table if not exists deal_deliverables (
  id          uuid        primary key default gen_random_uuid(),
  creator_id  uuid        not null references profiles(id) on delete cascade,
  deal_id     uuid        not null references deals(id) on delete cascade,

  -- What was sold. `ad_rights` and `auto_dm` are commercial add-ons rather
  -- than pieces of content, which is why platform below is nullable.
  kind        text        not null check (kind in (
                'reel', 'story', 'carousel', 'static_post',
                'yt_short', 'yt_long', 'yt_integration',
                'live', 'ad_rights', 'auto_dm', 'other'
              )),
  platform    text        check (platform in (
                'instagram_reel', 'instagram_feed', 'instagram_story',
                'youtube_short',  'youtube_long',
                'twitter', 'linkedin', 'other'
              )),

  quantity    smallint    not null default 1 check (quantity > 0),
  description text,
  rate        integer     not null default 0,  -- whole INR rupees

  due_date     date,
  published_at date,
  live_link    text,

  -- Ad-rights terms. Only meaningful when kind = 'ad_rights'. `expires_on` is
  -- stored rather than derived from starts_on + duration_months so it can be
  -- queried directly for the expiry reminder, matching how deals.ad_rights_
  -- expires_date already works.
  duration_months smallint,
  starts_on       date,
  expires_on      date,

  -- Manual performance entry, per item. A reel and a story from the same deal
  -- perform nothing alike, so these cannot live on the deal.
  views    integer,
  likes    integer,
  comments integer,
  saves    integer,
  shares   integer,
  reach    integer,
  performance_updated_at timestamptz,

  sort_order smallint    not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deal_deliverables_deal_idx
  on deal_deliverables (creator_id, deal_id, sort_order);
create index if not exists deal_deliverables_due_idx
  on deal_deliverables (creator_id, due_date) where published_at is null;
create index if not exists deal_deliverables_expiry_idx
  on deal_deliverables (creator_id, expires_on) where kind = 'ad_rights';

alter table deal_deliverables enable row level security;

drop policy if exists "Creators manage own deliverables" on deal_deliverables;
create policy "Creators manage own deliverables"
  on deal_deliverables for all
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

drop trigger if exists deal_deliverables_updated_at on deal_deliverables;
create trigger deal_deliverables_updated_at
  before update on deal_deliverables
  for each row execute function set_updated_at();


-- ── Backfill: every existing deal becomes one content deliverable ────────────
-- The old single-deliverable shape maps cleanly onto one row, so no deal
-- loses information and the new screens have something to render immediately.

insert into deal_deliverables (
  creator_id, deal_id, kind, platform, description, rate,
  due_date, published_at, live_link,
  views, likes, comments, saves, performance_updated_at, sort_order
)
select
  d.creator_id,
  d.id,
  case d.platform
    when 'instagram_reel'  then 'reel'
    when 'instagram_feed'  then 'static_post'
    when 'youtube_short'   then 'yt_short'
    when 'youtube_long'    then 'yt_long'
    -- Podcast deals were long-form video in practice; see the platform
    -- remap further down, which moves the parent deal the same way.
    when 'podcast'         then 'yt_long'
    else 'other'
  end,
  case when d.platform = 'podcast' then 'youtube_long' else d.platform end,
  d.deliverable_description,
  d.rate,
  d.publish_date,
  case when d.status in ('published', 'payment_awaited', 'paid') then d.publish_date end,
  d.live_link,
  d.performance_views,
  d.performance_likes,
  d.performance_comments,
  d.performance_saves,
  d.performance_updated_at,
  0
from deals d
-- Skips deals that already have line items, so a re-run tops up newly added
-- deals instead of duplicating every existing one.
where not exists (
  select 1 from deal_deliverables dd where dd.deal_id = d.id
);

-- Ad rights become a second, separate line item on the deals that sold them.
-- Note the rate is carried across but `deals.rate` is left untouched: the ad
-- rights fee has never been part of the deal rate or of any revenue figure,
-- and backfilling it into one would silently rewrite historical earnings.
insert into deal_deliverables (
  creator_id, deal_id, kind, description, rate,
  duration_months, starts_on, expires_on, sort_order
)
select
  d.creator_id,
  d.id,
  'ad_rights',
  'Paid amplification / whitelisting rights',
  coalesce(d.ad_rights_fee, 0),
  d.ad_rights_duration_months,
  d.ad_rights_start_date,
  d.ad_rights_expires_date,
  1
from deals d
where d.ad_rights_granted
  and not exists (
    select 1 from deal_deliverables dd
    where dd.deal_id = d.id and dd.kind = 'ad_rights'
  );


-- ── Platform list: drop podcast, add Instagram story ─────────────────────────
-- Stories are a first-class deliverable now, so they need a platform to sit on.

alter table deals drop constraint if exists deals_platform_check;

update deals set platform = 'youtube_long' where platform = 'podcast';

alter table deals add constraint deals_platform_check check (platform in (
  'instagram_reel', 'instagram_feed', 'instagram_story',
  'youtube_short',  'youtube_long',
  'twitter', 'linkedin', 'other'
));
