-- Where an announcement appears, not just what it says.
--
-- One strip was never going to be enough. A line of text at the top is right
-- for "payments are back to normal" and useless for a launch you want people to
-- stop and look at, and neither is a picture.
--
-- Three placements, one table. The alternative is a table per placement, which
-- means three admin screens and three chances to leave something published
-- past its date.

alter table announcements
  add column if not exists placement text not null default 'bar'
    check (placement in ('bar', 'popup', 'image'));

-- Only used by the image placement. Kept as a URL rather than a storage path
-- so an announcement can point at something already hosted, without waiting for
-- the media library to exist.
alter table announcements
  add column if not exists image_url text;

-- Ordering inside the strip, lowest first. Ties fall back to newest, which is
-- the sensible default for anything published without a thought about order.
alter table announcements
  add column if not exists sort_order int not null default 0;

comment on column announcements.placement is
  'bar: a line in the top strip. popup: a dismissible card over the page. image: a picture at the top of the app.';

-- The public read policy is unchanged and still governs every placement: a
-- popup and an image are exactly as invisible as a bar until published and
-- inside their window. That is the whole point of routing all three through
-- one table.
