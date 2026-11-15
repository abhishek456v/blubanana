-- ── Payment due dates stored one day early ──────────────────────────────────
--
-- A due date derived from the terms ("30 days from publish") was built as a
-- local-midnight Date and then written with toISOString(). For anybody ahead
-- of UTC, which is every user of this app (IST is +5:30), local midnight is
-- still the previous day in UTC, so the date that reached this table was one
-- day short: publish 18 Aug + 30 days was stored as 16 Sep, not 17 Sep. The
-- reminder fired a day early and the payment turned "overdue" a day early.
--
-- lib/deals.ts writes the right date from here on (calculateDueDate uses
-- toDateString). This corrects the rows already written.
--
-- ── Why this cannot touch a date somebody chose ─────────────────────────────
--
-- Only a row that is exactly the bug's signature moves:
--
--   * its due date is the derived date minus one day, to the day;
--   * it is the deal's only payment. Until this release that payment's due
--     date could not be set by hand at all; it was always derived. A split
--     deal's instalments were dated by hand, so those are left alone;
--   * it is not paid. A settled payment's due date is history.
--
-- The publish date is the deal's last stage, which is what the app derives
-- from (see handleSave in app/(app)/deal/[id].tsx).
--
-- A payment that was marked overdue only because of the missing day goes back
-- to pending. "Today" is the Indian date, for the same reason as above.

with publish as (
  select distinct on (deal_id) deal_id, due_date as publish_date
  from deal_stages
  order by deal_id, sort_order desc
),
derived as (
  select
    p.id,
    pub.publish_date + ((regexp_match(p.payment_terms, '(\d+)\s*days?', 'i'))[1])::int as correct
  from payments p
  join publish pub on pub.deal_id = p.deal_id
  where p.status <> 'paid'
    and p.due_date is not null
    and pub.publish_date is not null
    and p.payment_terms ~* '\d+\s*days?'
    and (select count(*) from payments s where s.deal_id = p.deal_id) = 1
)
update payments p
set
  due_date = d.correct,
  status = case
    when p.status = 'overdue' and d.correct >= (now() at time zone 'Asia/Kolkata')::date
      then 'pending'
    else p.status
  end
from derived d
where d.id = p.id
  and p.due_date = d.correct - 1;
