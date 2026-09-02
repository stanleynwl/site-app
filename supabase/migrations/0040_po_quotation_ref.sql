-- SiteApp — the supplier quotation a purchase order is priced from.
-- Printed on the PO next to the number (e.g. "Quotation Ref: KW/1015/QTN28052026"),
-- matching the paper form the office already uses. Optional: an order with no
-- quotation behind it simply leaves it blank and the line is not printed.
--
-- The local office app carries the same column (quotation_ref on its SQLite
-- purchase_orders) and syncs it up — see docs/PURCHASE_ORDER_SYNC.md.
--
-- Additive + idempotent.

alter table public.purchase_orders add column if not exists quotation_ref text;

-- Grants (explicit, to avoid the permission-denied trap — see 0004/0006) ------
grant all privileges on all tables    in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
