-- SiteApp Phase 10 — named-worker attendance card + monthly piece-rate claims.
-- Digitizes the paper worker cards: per-worker daily units (工数), advances
-- (支款), and the monthly work-done claim for subcontractors. Own workers are
-- paid by days (attendance × daily_rate); subcontractor workers by claim.
-- Additive + idempotent. Reuses patterns: suppliers (managed catalog) and
-- stock_counts (per-project member ledger). Grants block at end (see 0004/0006).

-- Subcontractors — company-wide managed list (clone of suppliers) -------------
create table if not exists public.subcontractors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  name text not null,
  phone text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Workers — company-wide. subcontractor_id NULL = own / in-house. daily_rate is
-- used for own workers' day-pay; subcontractor workers are paid via claims.
create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  name text not null,
  subcontractor_id uuid references public.subcontractors(id) on delete set null,
  daily_rate numeric(12, 2),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Attendance — one row per worker per day on a project (the card's rows).
-- worker_name is a free-text fallback for ad-hoc names not yet in the roster.
create table if not exists public.attendance_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  worker_id uuid references public.workers(id) on delete set null,
  worker_name text,
  work_date date not null,
  units numeric(5, 2) not null default 0 check (units >= 0),
  note text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One attendance row per roster worker per day (free-text rows are unconstrained).
create unique index if not exists attendance_unique_worker_day
  on public.attendance_entries (project_id, worker_id, work_date)
  where worker_id is not null;
create index if not exists attendance_project_date_idx
  on public.attendance_entries (project_id, work_date desc);

-- Advances (支款) — against a worker (own) or a subcontractor; deducted from the
-- relevant monthly payable.
create table if not exists public.advances (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  worker_id uuid references public.workers(id) on delete set null,
  subcontractor_id uuid references public.subcontractors(id) on delete set null,
  advance_date date not null,
  amount numeric(12, 2) not null check (amount >= 0),
  note text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (worker_id is not null or subcontractor_id is not null)
);
create index if not exists advances_project_date_idx
  on public.advances (project_id, advance_date desc);

-- Monthly piece-rate claim per subcontractor (the work-done claim) ------------
create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  subcontractor_id uuid not null references public.subcontractors(id) on delete cascade,
  period_month date not null,            -- first day of the claim month
  status text not null default 'draft',  -- 'draft' | 'final'
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, subcontractor_id, period_month)
);

create table if not exists public.claim_items (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  description text not null,             -- e.g. 'Pile cap', 'Ground beam'
  quantity numeric(12, 3) not null default 0,
  unit text,
  unit_price numeric(12, 2) not null default 0,
  sort_order integer not null default 0
);
create index if not exists claim_items_claim_idx on public.claim_items (claim_id);

-- updated_at triggers ---------------------------------------------------------
drop trigger if exists subcontractors_touch on public.subcontractors;
create trigger subcontractors_touch before update on public.subcontractors
  for each row execute function public.touch_updated_at();
drop trigger if exists workers_touch on public.workers;
create trigger workers_touch before update on public.workers
  for each row execute function public.touch_updated_at();
drop trigger if exists attendance_touch on public.attendance_entries;
create trigger attendance_touch before update on public.attendance_entries
  for each row execute function public.touch_updated_at();
drop trigger if exists claims_touch on public.claims;
create trigger claims_touch before update on public.claims
  for each row execute function public.touch_updated_at();

-- Helper: office-capable caller (role pm/office OR the can_office flag, which an
-- admin can grant independent of role — see 0022). Used by office-money writes.
create or replace function public.current_user_can_office()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select can_office from public.profiles where id = auth.uid()), false);

$$;

-- Row Level Security ----------------------------------------------------------
alter table public.subcontractors     enable row level security;
alter table public.workers            enable row level security;
alter table public.attendance_entries enable row level security;
alter table public.advances           enable row level security;
alter table public.claims             enable row level security;
alter table public.claim_items        enable row level security;

-- Subcontractors: any authenticated reads; pm/office writes (like suppliers).
drop policy if exists "subcontractors_select_auth" on public.subcontractors;
create policy "subcontractors_select_auth" on public.subcontractors
  for select to authenticated using (true);
drop policy if exists "subcontractors_write_office" on public.subcontractors;
create policy "subcontractors_write_office" on public.subcontractors
  for all to authenticated
  using (public.current_user_can_office())
  with check (public.current_user_can_office());

-- Workers: any authenticated reads; any authenticated may INSERT (supervisors
-- add new workers on site); pm/office may update/deactivate.
drop policy if exists "workers_select_auth" on public.workers;
create policy "workers_select_auth" on public.workers
  for select to authenticated using (true);
drop policy if exists "workers_insert_auth" on public.workers;
create policy "workers_insert_auth" on public.workers
  for insert to authenticated with check (true);
drop policy if exists "workers_update_office" on public.workers;
create policy "workers_update_office" on public.workers
  for update to authenticated
  using (public.current_user_can_office())
  with check (public.current_user_can_office());

-- Attendance: project members read + write their project's entries.
drop policy if exists "attendance_select_member" on public.attendance_entries;
create policy "attendance_select_member" on public.attendance_entries
  for select using (public.is_project_member(project_id));
drop policy if exists "attendance_insert_member" on public.attendance_entries;
create policy "attendance_insert_member" on public.attendance_entries
  for insert to authenticated with check (public.is_project_member(project_id));
drop policy if exists "attendance_update_member" on public.attendance_entries;
create policy "attendance_update_member" on public.attendance_entries
  for update using (public.is_project_member(project_id));
drop policy if exists "attendance_delete_member" on public.attendance_entries;
create policy "attendance_delete_member" on public.attendance_entries
  for delete using (public.is_project_member(project_id));

-- Advances: project members read + write.
drop policy if exists "advances_select_member" on public.advances;
create policy "advances_select_member" on public.advances
  for select using (public.is_project_member(project_id));
drop policy if exists "advances_insert_member" on public.advances;
create policy "advances_insert_member" on public.advances
  for insert to authenticated with check (public.is_project_member(project_id));
drop policy if exists "advances_update_member" on public.advances;
create policy "advances_update_member" on public.advances
  for update using (public.is_project_member(project_id));
drop policy if exists "advances_delete_member" on public.advances;
create policy "advances_delete_member" on public.advances
  for delete using (public.is_project_member(project_id));

-- Claims: project members read; pm/office write.
drop policy if exists "claims_select_member" on public.claims;
create policy "claims_select_member" on public.claims
  for select using (public.is_project_member(project_id));
drop policy if exists "claims_write_office" on public.claims;
create policy "claims_write_office" on public.claims
  for all to authenticated
  using (
    public.is_project_member(project_id) and public.current_user_can_office()
  )
  with check (
    public.is_project_member(project_id) and public.current_user_can_office()
  );

-- Claim items: access follows the parent claim's project; pm/office write.
drop policy if exists "claim_items_select_member" on public.claim_items;
create policy "claim_items_select_member" on public.claim_items
  for select using (
    exists (
      select 1 from public.claims c
      where c.id = claim_items.claim_id and public.is_project_member(c.project_id)
    )
  );
drop policy if exists "claim_items_write_office" on public.claim_items;
create policy "claim_items_write_office" on public.claim_items
  for all to authenticated
  using (
    exists (
      select 1 from public.claims c
      where c.id = claim_items.claim_id
        and public.is_project_member(c.project_id)
        and public.current_user_can_office()
    )
  )
  with check (
    exists (
      select 1 from public.claims c
      where c.id = claim_items.claim_id
        and public.is_project_member(c.project_id)
        and public.current_user_can_office()
    )
  );

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
