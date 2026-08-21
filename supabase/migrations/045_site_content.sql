-- Copy that can be changed without shipping anything.
--
-- ── What is in here, and what deliberately is not ───────────────────────────
--
-- Not every string. The app carries roughly 380 pieces of visible text, and
-- moving all of them into a table would mean the interface arrives after the
-- screens do, offline gets complicated, and nothing checks that a label exists
-- before it ships. It would also be solving a problem that is already solved:
-- an update pushes a copy change to every installed phone in about two
-- minutes.
--
-- What is here is the copy that actually gets tuned: the marketing headlines
-- somebody rewrites after watching people not sign up, the onboarding lines
-- that get rephrased every time somebody is confused, and the empty states,
-- which are really marketing surfaces wearing a helpful expression.
--
-- Button labels, field names and error messages stay in code. They change
-- rarely, and making them editable mostly creates opportunities for the
-- product to contradict itself.
--
-- ── Every row has a fallback in code ────────────────────────────────────────
--
-- The code that reads these passes what it would have said anyway. A missing
-- row, an unreachable database, a phone with no signal: all of them render the
-- sentence that shipped. Nothing here can produce a blank screen, which is the
-- usual way a content system fails.

create table if not exists site_content (
  -- Dotted and stable: `home.hero.title`. The key is the contract between a
  -- row and the line of code that reads it, so renaming one is a code change.
  key        text        primary key,
  value      text        not null,
  kind       text        not null default 'text' check (kind in ('text', 'html')),
  -- For the person editing, not for the code. Without these the screen is a
  -- list of dotted identifiers, which nobody can edit safely.
  label      text        not null,
  hint       text,
  -- 'website' needs a rebuild to take effect; 'app' takes effect on next open.
  -- The editing screen says which, because "I changed it and nothing happened"
  -- is otherwise the obvious conclusion.
  area       text        not null default 'website' check (area in ('website', 'app')),
  sort_order int         not null default 0,
  updated_by uuid        references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table site_content enable row level security;

drop policy if exists "content: readable by everyone" on site_content;
create policy "content: readable by everyone"
  on site_content for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on site_content from anon, authenticated;
grant select on site_content to anon, authenticated;

-- Seeded with exactly what the code says today, so adding this table changes
-- nothing about what anybody reads. The first build after it is byte for byte
-- what the last one was.
insert into site_content (key, value, kind, label, hint, area, sort_order) values
  ('home.hero.title',
   'Brand deals, deadlines and payments. One app, made for Indian creators.',
   'text', 'Home: the headline', 'The first line on blubanana.in. Keep it under about 12 words.', 'website', 10),
  ('home.hero.lede',
   'Log a deal in thirty seconds, never miss a deadline, and get paid without chasing.',
   'text', 'Home: the line under it', 'One sentence saying what it does.', 'website', 20),
  ('home.hero.fine',
   'No card needed. Works on the web, iOS and Android.',
   'text', 'Home: the small print under the buttons', null, 'website', 30),
  ('pricing.hero.title', 'One plan. Everything in it.',
   'text', 'Pricing: the headline', null, 'website', 40),
  ('pricing.hero.lede',
   'Every feature on every term. The only decision is how long you pay for at a time.',
   'text', 'Pricing: the line under it', null, 'website', 50),

  ('onboarding.you.title', 'Tell brands who you are',
   'text', 'Onboarding, step one: the heading', 'Shown once, just after somebody signs up.', 'app', 10),
  ('onboarding.you.lede',
   'This fills your profile card, the page you send a brand mid-negotiation. Everything is optional and editable later.',
   'text', 'Onboarding, step one: the explanation', null, 'app', 20),
  ('onboarding.money.title', 'How you get paid',
   'text', 'Onboarding, step two: the heading', null, 'app', 30),
  ('onboarding.money.lede',
   'These go on the invoices you raise. UPI is enough to start; bank details and GSTIN can wait until a brand asks.',
   'text', 'Onboarding, step two: the explanation', null, 'app', 40)
on conflict (key) do nothing;

comment on table site_content is
  'Editable copy for the website and the app. Every key has a fallback in code, so a missing row or an unreachable database changes nothing.';
