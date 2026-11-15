-- Ad rights sold on a deal are a line item of their own (`deal_deliverables`
-- with kind = 'ad_rights'), and the app mirrors that item onto the deal's
-- ad_rights_* columns. Migration 007 created the items for every deal that had
-- the columns set at the time.
--
-- The demo seed script went on writing the columns alone, so its deals carry a
-- fee that every list counts but the deal screen has no line for: the hero and
-- the deliverables total show the content rate, and saving the deliverables
-- would clear the fee. This repeats 007's statement for any deal in that state.
--
-- Adds rows only. `deals.rate`, the fee and every payment are left as they are.
-- Safe to run again: a deal that already has an ad-rights item is skipped.

insert into deal_deliverables (
  workspace_id, deal_id, kind, description, rate,
  duration_months, starts_on, expires_on, sort_order
)
select
  d.workspace_id,
  d.id,
  'ad_rights',
  'Paid amplification / whitelisting rights',
  d.ad_rights_fee,
  d.ad_rights_duration_months,
  d.ad_rights_start_date,
  d.ad_rights_expires_date,
  coalesce((select max(dd.sort_order) + 1 from deal_deliverables dd where dd.deal_id = d.id), 0)
from deals d
where d.ad_rights_granted
  and coalesce(d.ad_rights_fee, 0) > 0
  and not exists (
    select 1 from deal_deliverables dd
    where dd.deal_id = d.id and dd.kind = 'ad_rights'
  );
