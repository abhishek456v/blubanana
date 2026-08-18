-- 031: Remove the public profile page.
--
-- §8.11 is explicit that the shareable card "is NOT a public web page", and
-- the page at /creator/[slug] was the implementation it called wrong. The card
-- replaced it: an artefact she sends to a named brand, not a URL anyone can
-- find. Removing the page removes the columns that only existed to serve it.
--
-- The view is almost certainly already gone. It selected `d.creator_id`, and
-- 011 dropped that column with CASCADE, which takes dependent views with it —
-- meaning the public page has been erroring since 011 and nobody noticed,
-- which is its own argument for deleting rather than repairing it.
--
-- Nothing else reads either column: `public_share_slug` was the URL and
-- `public_profile_enabled` was the toggle.
--
-- Safe to re-run.

drop view if exists public_creator_profiles;

alter table profiles drop column if exists public_profile_enabled;
alter table profiles drop column if exists public_share_slug;


-- ── Verification ────────────────────────────────────────────────────────────

do $$
declare
  remaining text;
begin
  select string_agg(column_name, ', ') into remaining
    from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles'
     and column_name in ('public_profile_enabled', 'public_share_slug');

  if remaining is not null then
    raise exception 'Public profile columns survive: %', remaining;
  end if;

  if to_regclass('public.public_creator_profiles') is not null then
    raise exception 'public_creator_profiles view still exists';
  end if;

  raise notice 'OK. The public profile page and its columns are gone.';
end $$;
