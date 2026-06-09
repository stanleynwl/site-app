-- SiteApp — record WHEN a purchase request was ordered, so the "waiting" clock
-- (office SLA aging) stops once the office has placed the order. Before this the
-- age was always created_at → now, which kept growing even after ordering. The
-- three order paths (PO, order-no-PO, approve-&-order) all stamp ordered_at.
-- Additive + idempotent; no RLS change.

alter table public.purchase_requests
  add column if not exists ordered_at timestamptz;

-- Backfill: freeze the clock for requests already past the ordering step. Use
-- the delivery time when known, otherwise now() — so existing ordered requests
-- stop aging instead of jumping to a huge number.
update public.purchase_requests
  set ordered_at = coalesce(delivered_at, now())
  where ordered_at is null
    and status in ('po_issued', 'delivered', 'closed');

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
