-- 030: Give the 46 deals with no line items the line items 007 intended.
--
-- 007 created `deal_deliverables` and backfilled every existing deal into one
-- content row, "so no deal loses information and the new screens have something
-- to render immediately". It was even written to be re-run — it skips deals
-- that already have rows, precisely so it could top up new ones later.
--
-- It can no longer run. It inserts `creator_id`, which 011 dropped, and reads
-- `d.publish_date`, which 022 dropped. So deals created after 007 through a
-- path that did not write line items never got any, and the top-up it was
-- designed for was impossible. 46 of 49 deals are in that state: the deal
-- screen opens on an empty Deliverables card, and `contentValue()` returns 0
-- for a deal that is plainly worth something.
--
-- This is 007's backfill re-expressed against the schema as it now is.
--
-- ── Where the publish date comes from now ───────────────────────────────────
--
-- `deals.publish_date` is gone; the schedule lives in `deal_stages` (019). The
-- last stage by `sort_order` is the publish step, which is exactly how
-- `deal/new.tsx` derives the same date when it creates a deal today. Using
-- max(due_date) instead would pick a different stage whenever a later step
-- carries an earlier date.
--
-- `published_at` is set only for deals whose status says they went out. For
-- anything still in progress it stays null rather than being filled with a
-- planned date, which would claim a deal was published when it was not.
--
-- Safe to re-run: both inserts skip deals that already have the row.


-- ── 1. One content line per deal ────────────────────────────────────────────

insert into deal_deliverables (
  workspace_id, deal_id, kind, platform, description, rate, quantity,
  due_date, published_at, live_link,
  views, likes, comments, saves, performance_updated_at, sort_order
)
select
  d.workspace_id,
  d.id,
  case d.platform
    when 'instagram_reel'  then 'reel'
    when 'instagram_feed'  then 'static_post'
    when 'instagram_story' then 'story'
    when 'youtube_short'   then 'yt_short'
    when 'youtube_long'    then 'yt_long'
    else 'other'
  end,
  d.platform,
  d.deliverable_description,
  d.rate,
  1,
  last_stage.due_date,
  case when d.status in ('live', 'unpaid', 'paid') then last_stage.due_date end,
  d.live_link,
  d.performance_views,
  d.performance_likes,
  d.performance_comments,
  d.performance_saves,
  d.performance_updated_at,
  0
from deals d
left join lateral (
  select s.due_date
    from deal_stages s
   where s.deal_id = d.id
   order by s.sort_order desc
   limit 1
) last_stage on true
where not exists (
  select 1 from deal_deliverables dd where dd.deal_id = d.id
);


-- ── 2. Ad rights as a second line, where sold ───────────────────────────────
-- Verbatim from 007's reasoning: the fee is carried across but `deals.rate` is
-- left alone. The ad-rights fee has never been part of the deal rate or of any
-- revenue figure, and folding it in would silently rewrite historical earnings.

insert into deal_deliverables (
  workspace_id, deal_id, kind, description, rate, quantity,
  duration_months, starts_on, expires_on, sort_order
)
select
  d.workspace_id,
  d.id,
  'ad_rights',
  'Paid amplification / whitelisting rights',
  coalesce(d.ad_rights_fee, 0),
  1,
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


-- ── 3. Verification ─────────────────────────────────────────────────────────

do $$
declare
  orphans   integer;
  mismatched integer;
begin
  select count(*) into orphans
    from deals d
   where not exists (select 1 from deal_deliverables dd where dd.deal_id = d.id);

  if orphans > 0 then
    raise exception '% deal(s) still have no line items', orphans;
  end if;

  -- The content lines must sum to the deal's rate, or the Deliverables card
  -- and the deal header would disagree about what the deal is worth. Ad rights
  -- are excluded on both sides, as above.
  select count(*) into mismatched
    from deals d
    join lateral (
      select coalesce(sum(dd.rate), 0) as content_total
        from deal_deliverables dd
       where dd.deal_id = d.id and dd.kind <> 'ad_rights'
    ) t on true
   where t.content_total <> d.rate;

  if mismatched > 0 then
    raise notice
      '% deal(s) have line items that do not sum to the deal rate. Expected for deals itemised by hand since; not corrected here, because the line items are the more specific record.',
      mismatched;
  end if;

  raise notice 'OK. Every deal has line items.';
end $$;
