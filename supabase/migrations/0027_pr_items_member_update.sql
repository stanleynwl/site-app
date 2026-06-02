-- SiteApp — let any project member amend a purchase request line item (quantity)
-- on site, e.g. concrete 6m³ → 12m³, or down to 3m³. Members can already
-- select/insert items; this adds the missing UPDATE policy so the supervisor can
-- change quantities. RLS-only (no schema change), idempotent.

drop policy if exists "pr_items_update_member" on public.purchase_request_items;
create policy "pr_items_update_member" on public.purchase_request_items
  for update using (
    exists (
      select 1 from public.purchase_requests pr
      where pr.id = purchase_request_items.request_id
        and public.is_project_member(pr.project_id)
    )
  );

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
