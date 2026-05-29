-- SiteApp Phase 8 — project reference photos.
-- Office attaches 1–2 reference photos to a PROJECT (not per block) so the site
-- supervisor sees them at the top of the Progress / Stages screens and knows the
-- site at a glance. Stored in the shared photos table with an is_project_ref
-- flag. Additive + idempotent.
--
-- is_project_ref is a discriminator like delivery_id / purchase_request_id:
-- reference photos must NOT appear in the progress gallery, so getProjectPhotos
-- also filters is_project_ref = false.

alter table public.photos
  add column if not exists is_project_ref boolean not null default false;

create index if not exists photos_project_ref_idx
  on public.photos (project_id, is_project_ref);

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
