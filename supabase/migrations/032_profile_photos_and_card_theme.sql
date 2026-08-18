-- 032: Profile photos, and the rate card's theme.
--
-- §8.11's card carries a photo, and the app has never had anywhere to put one:
-- `profiles` has no avatar column, so the card fell back to a monogram. A
-- monogram on the artefact a brand judges her by is the wrong first impression.
--
-- A creator keeps up to three photos and picks which one the card uses, rather
-- than one avatar she has to overwrite. She needs a different shot for a
-- fashion brand than for a tech brand, and re-uploading each time is the
-- friction that stops the card being sent at all.
--
-- ── Why a table rather than columns ─────────────────────────────────────────
--
-- photo_1 / photo_2 / photo_3 would need renumbering on every delete, and
-- "which one is the card using" becomes an index rather than a reference.
-- Rows carry their own order and can be pointed at.
--
-- ── Why per-user rather than per-workspace ──────────────────────────────────
--
-- A photo is of a person. A manager invited into the workspace should not
-- inherit the creator's face, and should be able to keep their own.
--
-- Safe to re-run.


-- ── 1. The bucket ───────────────────────────────────────────────────────────
-- Private, like `attachments`. The card embeds the image in the document it
-- generates, so nothing needs a public URL — and a public bucket would make
-- every photo she has ever uploaded permanently fetchable by anyone with the
-- path, including the ones she decided not to use.

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', false)
on conflict (id) do nothing;

drop policy if exists "profile photos: own folder only" on storage.objects;
create policy "profile photos: own folder only"
on storage.objects for all to authenticated
using (
  bucket_id = 'profile-photos'
  -- Compared as text rather than cast to uuid: an object whose first segment
  -- is not a uuid would make the cast throw, and a storage policy that errors
  -- denies everything (the lesson of 016).
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);


-- ── 2. The photos ───────────────────────────────────────────────────────────

create table if not exists profile_photos (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references profiles(id) on delete cascade,
  -- Storage has no foreign keys, so this is the only record that the object
  -- exists. Deleting the row is what makes the app forget the file; the
  -- delete-account function walks the bucket separately.
  path       text        not null unique,
  sort_order integer     not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists profile_photos_user_idx on profile_photos (user_id, sort_order);

alter table profile_photos enable row level security;

drop policy if exists "profile_photos: own rows" on profile_photos;
create policy "profile_photos: own rows"
  on profile_photos for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ── 3. Three, and no more ───────────────────────────────────────────────────
-- Enforced in the database rather than in the upload screen. The limit exists
-- so the picker stays a glance rather than a gallery, and a limit that only
-- lives in the UI is not a limit.

create or replace function enforce_profile_photo_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from profile_photos where user_id = new.user_id) >= 3 then
    raise exception 'A profile can hold at most three photos'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists profile_photos_limit on profile_photos;
create trigger profile_photos_limit
  before insert on profile_photos
  for each row execute function enforce_profile_photo_limit();


-- ── 4. What the card uses ───────────────────────────────────────────────────
-- `on delete set null` rather than cascade: deleting the chosen photo should
-- fall the card back to a monogram, not delete the profile.

alter table profiles add column if not exists card_photo_id uuid
  references profile_photos(id) on delete set null;

-- The theme is a preference, not a per-share edit: suggested from her niche,
-- changed with a picker, and it stays changed. Null means "follow the niche",
-- so a creator who never opens the picker keeps getting the right suggestion
-- as her niche changes.
alter table profiles add column if not exists card_theme text;


-- ── 5. Verification ─────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'profile-photos') then
    raise exception 'The profile-photos bucket was not created';
  end if;

  if exists (select 1 from storage.buckets where id = 'profile-photos' and public) then
    raise exception 'The profile-photos bucket is public; it must not be';
  end if;

  if to_regclass('public.profile_photos') is null then
    raise exception 'profile_photos was not created';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
       and column_name in ('card_photo_id', 'card_theme')
     having count(*) = 2
  ) then
    raise exception 'card_photo_id / card_theme are missing from profiles';
  end if;

  raise notice 'OK. Profile photos and the card theme are in place.';
end $$;
