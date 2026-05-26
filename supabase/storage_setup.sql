-- SiteApp — Supabase Storage bucket + RLS for site photos.
-- Run once in the Supabase SQL Editor. Idempotent.
-- Files live under the `site-photos` bucket, keyed as:
--   photos/{YYYY-MM}/{project_id}/{uuid}.jpg
-- (month-foldered so a whole month can be archived/deleted as one prefix).

-- Private bucket (served via short-lived signed URLs, never public).
insert into storage.buckets (id, name, public)
values ('site-photos', 'site-photos', false)
on conflict (id) do nothing;

-- v1 coarse policy: any authenticated user may read/write/delete objects in the
-- bucket. Per-project path enforcement can be added later.
drop policy if exists "site_photos_select" on storage.objects;
create policy "site_photos_select" on storage.objects
  for select to authenticated using (bucket_id = 'site-photos');

drop policy if exists "site_photos_insert" on storage.objects;
create policy "site_photos_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'site-photos');

drop policy if exists "site_photos_update" on storage.objects;
create policy "site_photos_update" on storage.objects
  for update to authenticated using (bucket_id = 'site-photos');

drop policy if exists "site_photos_delete" on storage.objects;
create policy "site_photos_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'site-photos');
