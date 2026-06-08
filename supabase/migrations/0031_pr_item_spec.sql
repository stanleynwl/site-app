-- SiteApp — add a free-text "size / spec" to a purchase request line item.
-- Suppliers sometimes quote extra detail that quantity + unit can't hold, e.g.
-- timber length per piece ("12 ft"), a tonnage note, or a piece count
-- ("100 pcs, mixed 10–14 ft"). One optional text column captures it however it
-- is quoted. Additive + idempotent; no RLS change (existing item policies apply).

alter table public.purchase_request_items
  add column if not exists spec text;

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
