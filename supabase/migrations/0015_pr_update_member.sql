-- SiteApp Phase 4 (revised) — let project members update purchase_requests, so a
-- supervisor can CONFIRM DELIVERY on their own request (status → delivered).
-- Office-only transitions (accept / reject / order-PO / close) stay gated in the
-- server-action layer by role; this only relaxes the row-level update gate.
-- Idempotent.

drop policy if exists "pr_update_office" on public.purchase_requests;
drop policy if exists "pr_update_member" on public.purchase_requests;
create policy "pr_update_member" on public.purchase_requests
  for update using (public.is_project_member(project_id));

grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
