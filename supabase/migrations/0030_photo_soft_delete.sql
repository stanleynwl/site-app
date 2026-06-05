-- Soft-delete for photos: a "deleted" photo is hidden from all views but kept
-- recoverable for 3 days, then purged (storage object + row) by the app. Lets
-- the office undo an accidental photo delete. Additive + idempotent.

alter table public.photos
  add column if not exists deleted_at timestamptz;

create index if not exists photos_deleted_idx on public.photos (deleted_at);

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
