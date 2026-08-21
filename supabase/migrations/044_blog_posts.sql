-- The blog, moved out of the code and into the database.
--
-- ── Why this one is different from pricing ──────────────────────────────────
--
-- Pricing is read at runtime by the browser, so changing a row changes the
-- public page within seconds and no deploy is involved. That is exactly wrong
-- for a blog: the post body would arrive after the page did, and a search
-- engine crawling it would see an empty article. These five posts exist to be
-- found in search. Arriving late defeats the entire point of writing them.
--
-- So the site stays fully static and reads these at *build* time, and
-- publishing a post asks Vercel to rebuild. A post takes a minute or two to
-- appear, which is the correct trade for being visible to Google at all.
--
-- ── What is stored, and what is computed ────────────────────────────────────
--
-- The date is stored; "20 August 2026" is not. A stored label is a second
-- copy of the same fact that drifts the first time somebody edits one and not
-- the other. Same for the reading time: minutes are stored, "6 min" is not.

create table if not exists blog_posts (
  id           uuid        primary key default gen_random_uuid(),
  -- The address. Changing it breaks every link anybody has ever shared, so the
  -- editor warns about that rather than the database preventing it.
  slug         text        not null unique,
  title        text        not null,
  -- The publication date shown on the post. Not created_at: a post written
  -- over three evenings is dated the day it goes out.
  date         date        not null default current_date,
  -- Only when a post has genuinely been revised. A "last updated" line that
  -- moves on every rebuild is the oldest trick in content marketing and
  -- readers can tell, which is why nothing sets this automatically.
  updated      date,
  read_minutes int         not null default 5,
  description  text        not null,
  lede         text        not null,
  body_html    text        not null,
  -- Every post ends at the calculator that does the arithmetic it describes.
  -- That link is the reason these posts earn anything, so it is a column
  -- rather than something to remember to add.
  tool_href    text        not null default '/tools',
  tool_label   text        not null default 'Try the calculators',
  cover_url    text,
  published    boolean     not null default false,
  published_at timestamptz,
  created_by   uuid        references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists blog_posts_live_idx
  on blog_posts (published, date desc) where published;

alter table blog_posts enable row level security;

-- Published posts are world readable, which is what lets the website build
-- read them with the anonymous key and no secret in the deploy.
--
-- Drafts are not. Writing next week's post today has to be safe, and "nobody
-- has the URL yet" is not safety when the API is public.
drop policy if exists "blog: published posts are public" on blog_posts;
create policy "blog: published posts are public"
  on blog_posts for select
  to anon, authenticated
  using (published);

revoke insert, update, delete on blog_posts from anon, authenticated;
grant select on blog_posts to anon, authenticated;

comment on table blog_posts is
  'Blog posts. Published rows are world readable and are read by the website at build time; writes go through the admin edge function only.';
