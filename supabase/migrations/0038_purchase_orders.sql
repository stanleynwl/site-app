-- SiteApp — purchase orders generated in the web app, shared with the local
-- office app. Until now procurement was capture-only: purchase_requests.po_number
-- was a free-text field and the PO document itself was produced by the local
-- office app, which kept its own numbering (PO-4718, PO-4715 Rev 1) in its own
-- store. Supabase now becomes the single source of truth for PO records so both
-- sides read and write the same rows.
--
-- Sync contract for the local app: see docs/PURCHASE_ORDER_SYNC.md. In short —
-- call public.next_po_number() to mint a number (never generate one locally),
-- insert into purchase_orders with source = 'local', and treat po_number as the
-- shared key. The sequence guarantees the two systems can never collide.
--
-- Additive + idempotent.

-- Shared PO number sequence ---------------------------------------------------
-- Starts past the local app's highest known PO (4718 as of 2026-08). If the
-- local app has since gone higher, bump it BEFORE issuing any web PO:
--   select setval('public.po_number_seq', <highest existing PO number>);
create sequence if not exists public.po_number_seq as bigint start with 4719 increment by 1;

-- Mints the next PO number as the formatted string both systems display.
-- SECURITY DEFINER so the sequence itself needn't be writable by every caller;
-- office/local both go through this one door.
create or replace function public.next_po_number()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_n bigint;
begin
  select nextval('public.po_number_seq') into v_n;
  return 'PO-' || v_n::text;
end $$;

revoke all on function public.next_po_number() from public, anon;
grant execute on function public.next_po_number() to authenticated, service_role;

-- Letterhead + supplier detail the PO document needs --------------------------
alter table public.companies  add column if not exists address         text;
alter table public.companies  add column if not exists phone           text;
alter table public.companies  add column if not exists email           text;
alter table public.companies  add column if not exists registration_no text;

alter table public.suppliers  add column if not exists address       text;
alter table public.suppliers  add column if not exists email         text;
alter table public.suppliers  add column if not exists payment_terms text;

-- Where the goods actually go (projects.location is a descriptive label).
alter table public.projects   add column if not exists delivery_address text;

-- Purchase orders -------------------------------------------------------------
-- status: draft (office still keying prices) -> issued (sent to supplier)
--         -> cancelled. revision > 0 renders as "Rev N" on the document.
-- source records which system created the row ('web' | 'local') — purely for
-- traceability when reconciling with the local app.
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique,
  revision integer not null default 0 check (revision >= 0),
  project_id uuid not null references public.projects(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  purchase_request_id uuid references public.purchase_requests(id) on delete set null,
  status text not null default 'draft',
  needed_by date,
  delivery_address text,
  terms text,
  note text,
  tax_percent numeric(5, 2) not null default 0 check (tax_percent >= 0),
  source text not null default 'web',
  issued_at timestamptz,
  issued_by uuid references auth.users(id) on delete set null,
  issued_by_name text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists purchase_orders_project_idx
  on public.purchase_orders (project_id, created_at desc);
create index if not exists purchase_orders_request_idx
  on public.purchase_orders (purchase_request_id);
create index if not exists purchase_orders_status_idx
  on public.purchase_orders (status, created_at desc);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  material_id uuid references public.materials(id) on delete set null,
  material_text text,                    -- fallback when not in the catalog
  spec text,
  quantity numeric(12, 3) not null default 0,
  unit text,
  unit_price numeric(12, 2) not null default 0,
  sort_order integer not null default 0
);
create index if not exists purchase_order_items_po_idx
  on public.purchase_order_items (po_id);

-- updated_at trigger ----------------------------------------------------------
drop trigger if exists purchase_orders_touch on public.purchase_orders;
create trigger purchase_orders_touch before update on public.purchase_orders
  for each row execute function public.touch_updated_at();

-- Row Level Security ----------------------------------------------------------
alter table public.purchase_orders      enable row level security;
alter table public.purchase_order_items enable row level security;

-- Project members read (site can see what was ordered); pm/office write.
drop policy if exists "po_select_member" on public.purchase_orders;
create policy "po_select_member" on public.purchase_orders
  for select using (public.is_project_member(project_id));
drop policy if exists "po_write_office" on public.purchase_orders;
create policy "po_write_office" on public.purchase_orders
  for all to authenticated
  using (
    public.is_project_member(project_id) and public.current_user_can_office()
  )
  with check (
    public.is_project_member(project_id) and public.current_user_can_office()
  );

-- Items follow the parent PO's project.
drop policy if exists "po_items_select_member" on public.purchase_order_items;
create policy "po_items_select_member" on public.purchase_order_items
  for select using (
    exists (
      select 1 from public.purchase_orders o
      where o.id = purchase_order_items.po_id and public.is_project_member(o.project_id)
    )
  );
drop policy if exists "po_items_write_office" on public.purchase_order_items;
create policy "po_items_write_office" on public.purchase_order_items
  for all to authenticated
  using (
    exists (
      select 1 from public.purchase_orders o
      where o.id = purchase_order_items.po_id
        and public.is_project_member(o.project_id)
        and public.current_user_can_office()
    )
  )
  with check (
    exists (
      select 1 from public.purchase_orders o
      where o.id = purchase_order_items.po_id
        and public.is_project_member(o.project_id)
        and public.current_user_can_office()
    )
  );

-- Grants (explicit, to avoid the permission-denied trap — see 0004/0006) ------
grant all privileges on all tables    in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
