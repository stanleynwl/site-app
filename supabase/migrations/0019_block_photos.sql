-- SiteApp Phase 8 — reference photos per block.
-- Office attaches 1–2 photos to each block so the site supervisor can recognise
-- which physical building is which. Stored in the shared photos table, linked to
-- the block. Additive + idempotent.
--
-- Like delivery_id / purchase_request_id, block_id is a discriminator: block
-- reference photos must NOT appear in the progress gallery, so getProjectPhotos
-- also filters block_id IS NULL.

alter table public.photos
  add column if not exists block_id uuid
  references public.project_blocks(id) on delete cascade;

create index if not exists photos_block_idx
  on public.photos (block_id);

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
