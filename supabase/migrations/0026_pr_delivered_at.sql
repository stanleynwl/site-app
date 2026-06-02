-- SiteApp — keep delivered purchase requests on the supervisor's list for a
-- short hold window after delivery (instead of vanishing immediately). We record
-- WHEN a request was confirmed delivered so the site list can show it for N days.
-- Additive + idempotent.

alter table public.purchase_requests
  add column if not exists delivered_at timestamptz;

-- Backfill existing delivered rows so they don't all reappear: stamp them in the
-- past (updated_at if present, else created_at) so they're already past the hold.
update public.purchase_requests
  set delivered_at = coalesce(updated_at, created_at)
  where status = 'delivered' and delivered_at is null;

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
