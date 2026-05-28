-- SiteApp Phase 5 (operations) — weekly stock-on-site counts.
-- A stock_count is a physical count of one catalog material on site on a date.
-- Consumption is DERIVED (not stored): between two counts, consumption =
-- previous + deliveries-in-between − current (Design Principle #3: track what's
-- verifiable, derive what isn't). Additive + idempotent. RLS by project membership.

create table if not exists public.stock_counts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  count_date date not null,
  quantity numeric(12, 3) not null,
  unit text,
  note text,
  counted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, material_id, count_date)  -- one count per material/day
);

-- Indexes ---------------------------------------------------------------------
create index if not exists stock_counts_project_idx
  on public.stock_counts (project_id, material_id, count_date desc);

-- updated_at trigger ----------------------------------------------------------
drop trigger if exists stock_counts_touch on public.stock_counts;
create trigger stock_counts_touch before update on public.stock_counts
  for each row execute function public.touch_updated_at();

-- Row Level Security ----------------------------------------------------------
alter table public.stock_counts enable row level security;

drop policy if exists "stock_counts_select_member" on public.stock_counts;
create policy "stock_counts_select_member" on public.stock_counts
  for select using (public.is_project_member(project_id));
drop policy if exists "stock_counts_insert_member" on public.stock_counts;
create policy "stock_counts_insert_member" on public.stock_counts
  for insert to authenticated with check (public.is_project_member(project_id));
drop policy if exists "stock_counts_update_member" on public.stock_counts;
create policy "stock_counts_update_member" on public.stock_counts
  for update using (public.is_project_member(project_id));
drop policy if exists "stock_counts_delete_member" on public.stock_counts;
create policy "stock_counts_delete_member" on public.stock_counts
  for delete using (public.is_project_member(project_id));

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
