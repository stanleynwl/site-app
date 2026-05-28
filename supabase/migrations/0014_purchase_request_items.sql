-- SiteApp Phase 4 (revised) — multi-item purchase requests.
-- A request becomes a header (project / needed-by / urgency / status / supplier
-- / PO) with one or more LINE ITEMS, so site can order several materials from
-- the same supplier in one request (e.g. timber 1x2 + timber 2x3). Deliveries
-- link to a specific item to close the variance loop. Additive + idempotent.

create table if not exists public.purchase_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.purchase_requests(id) on delete cascade,
  material_id uuid references public.materials(id) on delete set null,
  material_text text,                 -- fallback when material not in the catalog
  quantity numeric(12, 3),
  unit text,
  created_at timestamptz not null default now()
);

create index if not exists pr_items_request_idx
  on public.purchase_request_items (request_id);

-- Deliveries can link to a specific request item (the variance loop-closer).
alter table public.deliveries
  add column if not exists purchase_request_item_id uuid
  references public.purchase_request_items(id) on delete set null;

-- Backfill: turn each existing single-material request into one line item.
insert into public.purchase_request_items (request_id, material_id, material_text, quantity, unit)
select pr.id, pr.material_id, pr.material_text, pr.quantity, pr.unit
from public.purchase_requests pr
where (pr.material_id is not null or pr.material_text is not null)
  and not exists (
    select 1 from public.purchase_request_items i where i.request_id = pr.id
  );

-- Row Level Security — access follows the parent request's project.
alter table public.purchase_request_items enable row level security;

drop policy if exists "pr_items_select_member" on public.purchase_request_items;
create policy "pr_items_select_member" on public.purchase_request_items
  for select using (
    exists (
      select 1 from public.purchase_requests pr
      where pr.id = purchase_request_items.request_id
        and public.is_project_member(pr.project_id)
    )
  );

drop policy if exists "pr_items_insert_member" on public.purchase_request_items;
create policy "pr_items_insert_member" on public.purchase_request_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.purchase_requests pr
      where pr.id = purchase_request_items.request_id
        and public.is_project_member(pr.project_id)
    )
  );

drop policy if exists "pr_items_delete_office" on public.purchase_request_items;
create policy "pr_items_delete_office" on public.purchase_request_items
  for delete using (
    exists (
      select 1 from public.purchase_requests pr
      where pr.id = purchase_request_items.request_id
        and public.is_project_member(pr.project_id)
        and public.current_user_role() in ('pm', 'office')
    )
  );

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
