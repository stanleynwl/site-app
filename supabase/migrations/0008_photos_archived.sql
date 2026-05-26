-- SiteApp — mark photos whose binary has been archived off Supabase Storage.
-- The archive script downloads old photo files to the PC and deletes them from
-- Storage to stay under the free tier, but KEEPS the metadata row (flagged here)
-- and all other data. The app skips rendering archived photos. Additive.

alter table public.photos
  add column if not exists archived_at timestamptz;

create index if not exists photos_archived_idx on public.photos (archived_at);
