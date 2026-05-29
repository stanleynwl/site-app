-- SiteApp Phase 8 — photos on a purchase request.
-- Supervisors can snap a photo of what they need (e.g. a long material spec or a
-- sample) instead of typing it. Mirrors delivery photos: the binary lives in
-- Storage; this just links a photos row to the request. Additive + idempotent.
--
-- IMPORTANT: progress photos are "photos with delivery_id IS NULL". Request
-- photos must NOT leak into the progress gallery, so the read layer
-- (getProjectPhotos) also filters purchase_request_id IS NULL.

alter table public.photos
  add column if not exists purchase_request_id uuid
  references public.purchase_requests(id) on delete set null;

create index if not exists photos_request_idx
  on public.photos (purchase_request_id);

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
