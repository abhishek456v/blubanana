-- The media library: one place for every picture and video the product shows.
--
-- Until now an image was either committed into the website repository or
-- pasted in as somebody else's URL. The first needs a deploy to change, the
-- second breaks the day that somebody else reorganises their site. Neither is
-- something to build a launch banner on.
--
-- ── Why a public bucket, when the other two are private ─────────────────────
--
-- `attachments` and `profile-photos` hold one creator's contracts and face,
-- and are private for the obvious reason. This bucket holds things whose whole
-- purpose is to be seen by strangers: a banner on the marketing site, a
-- picture at the top of the app. A signed URL for those would expire, which
-- turns "the launch banner" into "the launch banner, until Thursday".
--
-- Public means readable, not writable. Nothing below grants any client the
-- right to put a file here.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-media',
  'public-media',
  true,
  -- 25 MB. Enough for a long banner video, small enough that a mistake is not
  -- a bill. Enforced by storage itself, so it holds even if the upload path is
  -- ever called from somewhere new.
  26214400,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
    'video/mp4', 'video/webm',
    'application/pdf'
  ]
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ── Who may write into it: nobody, through a client ─────────────────────────
--
-- No insert, update or delete policy exists on storage.objects for this
-- bucket, so RLS refuses every client write. Uploads happen against a signed
-- upload URL minted by the admin edge function after it has checked the
-- caller's platform role, which means the permission to upload is granted per
-- file, by the server, and expires.
--
-- The alternative was a policy reading platform_role(). That would have worked
-- and it is one line shorter. It is not what is here because it leaves a
-- standing right to write to a public bucket attached to a browser session,
-- and a standing right is the thing that gets used later by something nobody
-- reviewed.
drop policy if exists "public-media: anyone may read" on storage.objects;
create policy "public-media: anyone may read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'public-media');


-- ── The catalogue ───────────────────────────────────────────────────────────
--
-- Storage can list a bucket, so a table of files is not strictly needed. It is
-- here for the things storage does not hold: what a picture is of, what its
-- alt text should be, and which of four hundred files is the one you meant.
-- A library you cannot search is a folder.
create table if not exists media (
  id          uuid        primary key default gen_random_uuid(),
  kind        text        not null check (kind in ('image', 'video', 'document')),
  -- The object path inside the bucket. Unique, because two rows pointing at
  -- one file means deleting either one breaks the other.
  path        text        not null unique,
  -- The resolved public URL, stored rather than derived. Anything that renders
  -- media then needs no knowledge of Supabase, which matters for the website,
  -- which is static HTML and has no client at build time.
  url         text        not null,
  title       text        not null,
  -- What the picture is of, for anybody who cannot see it. Optional in the
  -- database and asked for in the interface, because a required field here
  -- would only teach people to type a full stop.
  alt         text,
  mime        text        not null,
  bytes       bigint      not null default 0,
  width       int,
  height      int,
  -- A flat label, not a folder tree. Trees get deep and then nobody can find
  -- anything; a label can be renamed without moving a file.
  folder      text        not null default 'general',
  uploaded_by uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists media_folder_idx on media (folder, created_at desc);
create index if not exists media_kind_idx on media (kind, created_at desc);

alter table media enable row level security;

-- Readable by everyone, for the same reason the bucket is: the app and the
-- website both need to render these, and the website reads Supabase with the
-- anonymous key at runtime the same way it already reads pricing.
drop policy if exists "media: readable by everyone" on media;
create policy "media: readable by everyone"
  on media for select
  to anon, authenticated
  using (true);

-- Writes: through the admin edge function only. Same reasoning as
-- announcements and platform_admins.
revoke insert, update, delete on media from anon, authenticated;
grant select on media to anon, authenticated;

comment on table media is
  'Pictures and video for the website and the app. Rows are world readable; writes go through the admin edge function only.';
