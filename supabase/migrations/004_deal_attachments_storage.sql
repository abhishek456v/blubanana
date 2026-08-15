-- ─────────────────────────────────────────────────────────────────────────────
-- CreatorDesk: deal attachments storage (PRODUCT.md 1: "attachments
-- (contracts/briefs, stored as files in Supabase storage)")
-- Run this once in the Supabase dashboard SQL editor (or via supabase db push).
--
-- Objects live at {creator_id}/{deal_id}/{filename} in the `attachments`
-- bucket, with no separate DB table, since Storage already tracks the file list
-- and a synced-copy table would just be another thing to keep in sync. The
-- RLS policy checks the first path segment against auth.uid(), so a creator
-- can only ever read/write objects under their own folder. This does not
-- check deal ownership specifically (any deal_id under a creator's own
-- folder is allowed), acceptable since a creator can only ever reach a
-- deal ID that's already scoped to their own account via the deals RLS
-- policy in 001_initial_schema.sql.
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy "attachments: own folder only"
on storage.objects for all
using (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);
