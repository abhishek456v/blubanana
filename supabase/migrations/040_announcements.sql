-- Broadcast: news, banners and alerts, across the app and the website.
--
-- One table rather than three. A "banner" and an "alert" differ in how loud
-- they look and nothing else, and three tables would mean three admin screens
-- and three places to forget to set an end date.
--
-- Reads are public on purpose. The website is a static build that already
-- fetches live pricing from here with the anon key, and this rides the same
-- path so publishing takes effect without a deploy. Nothing in this table is
-- secret: it is, by definition, the thing being shouted.

create table if not exists announcements (
  id         uuid        primary key default gen_random_uuid(),
  -- news    quiet, sits in a list
  -- banner  a strip across the top
  -- alert   loud, coloured, for something wrong
  kind       text        not null default 'banner' check (kind in ('news', 'banner', 'alert')),
  title      text        not null,
  body       text,
  -- Where it shows. Both is the common case; one or the other is for things
  -- that only make sense to a signed-in creator, or only to a visitor.
  surface    text        not null default 'both' check (surface in ('app', 'website', 'both')),
  -- Who sees it, inside the app. Ignored on the website, which has no idea who
  -- is reading.
  audience   text        not null default 'everyone'
             check (audience in ('everyone', 'trialing', 'paying', 'lapsed')),
  /** A link the whole thing becomes clickable to, if set. */
  link_url   text,
  link_label text,
  dismissible boolean    not null default true,
  starts_at  timestamptz not null default now(),
  -- Null means it runs until somebody stops it. The admin screen warns about
  -- that, because the usual way a banner embarrasses somebody is by still
  -- being there in March.
  ends_at    timestamptz,
  published  boolean     not null default false,
  created_by uuid        references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists announcements_live_idx
  on announcements (published, starts_at desc) where published;

alter table announcements enable row level security;

-- ── Reading ─────────────────────────────────────────────────────────────────
--
-- Anyone may read a published one that is currently within its window. Nobody
-- may read a draft, which is what makes it safe to write next week's
-- announcement today.
drop policy if exists "announcements: live ones are public" on announcements;
create policy "announcements: live ones are public"
  on announcements for select
  to anon, authenticated
  using (
    published
    and starts_at <= now()
    and (ends_at is null or ends_at > now())
  );

-- ── Writing ─────────────────────────────────────────────────────────────────
--
-- Nobody, through this path. No insert, update or delete policy exists, so
-- every write goes through the admin edge function on the service role, which
-- checks the platform role first. Same reasoning as `platform_admins`: the
-- browser is never the thing deciding who may publish.
revoke insert, update, delete on announcements from anon, authenticated;
grant select on announcements to anon, authenticated;

comment on table announcements is
  'Broadcast messages. Published rows inside their window are world readable; writes go through the admin edge function only.';
