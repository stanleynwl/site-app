-- SiteApp — accounting code on subcontractors, matching suppliers.code.
-- Lets the subcontractor list carry the creditor account code (e.g. 4001/B02)
-- so the office can reconcile claims against the accounting ledger.
-- Additive + idempotent.

alter table public.subcontractors add column if not exists code text;

-- Grants (explicit; see the permission-denied trap in 0004/0006).
grant all privileges on all tables    in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
