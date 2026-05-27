-- SiteApp Phase 4 — purchase requests (capture-only procurement).
-- Supervisor raises a request → office queue with aging → PO number captured
-- (the PO itself is issued outside the app) → linked to a delivery/DO → closed.
-- This closes the three-quantity variance loop: a linked delivery's
-- requested_quantity is taken from the request.
-- Additive + idempotent. RLS scopes by project membership; pm/office drive state.

-- Status enum -----------------------------------------------------------------
do $$ begin
  create type purchase_request_status as enum
    ('pending', 'approved', 'po_issued', 'delivered', 'closed', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  material_id uuid references public.materials(id) on delete set null,
  material_text text,                 -- fallback when material not in the catalog
  quantity numeric(12, 3),
  unit text,
  needed_by date,
  urgency_reason text,                -- free-text "why urgent" (no discrete levels)
  note text,
  status purchase_request_status not null default 'pending',
  supplier_id uuid references public.suppliers(id) on delete set null,
  po_number text,
  rejected_reason text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Now that purchase_requests exists, wire the forward-looking FK on deliveries
-- (Design Principle #4 — the nullable column was added in 0006).
do $$ begin
  alter table public.deliveries
    add constraint deliveries_purchase_request_id_fkey
    foreign key (purchase_request_id)
    references public.purchase_requests(id) on delete set null;
exception when duplicate_object then null; end $$;

-- Indexes ---------------------------------------------------------------------
create index if not exists purchase_requests_project_idx
  on public.purchase_requests (project_id, status, created_at desc);
create index if not exists purchase_requests_status_idx
  on public.purchase_requests (status, created_at);

-- updated_at trigger ----------------------------------------------------------
drop trigger if exists purchase_requests_touch on public.purchase_requests;
create trigger purchase_requests_touch before update on public.purchase_requests
  for each row execute function public.touch_updated_at();

-- Row Level Security ----------------------------------------------------------
alter table public.purchase_requests enable row level security;

-- Members read; members may raise (insert); pm/office approve/update/delete.
drop policy if exists "pr_select_member" on public.purchase_requests;
create policy "pr_select_member" on public.purchase_requests
  for select using (public.is_project_member(project_id));

drop policy if exists "pr_insert_member" on public.purchase_requests;
create policy "pr_insert_member" on public.purchase_requests
  for insert to authenticated with check (public.is_project_member(project_id));

drop policy if exists "pr_update_office" on public.purchase_requests;
create policy "pr_update_office" on public.purchase_requests
  for update using (
    public.is_project_member(project_id) and public.current_user_role() in ('pm', 'office')
  );

drop policy if exists "pr_delete_office" on public.purchase_requests;
create policy "pr_delete_office" on public.purchase_requests
  for delete using (
    public.is_project_member(project_id) and public.current_user_role() in ('pm', 'office')
  );

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
