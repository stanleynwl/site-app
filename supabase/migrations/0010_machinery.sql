-- SiteApp Phase 5 (operations) — machinery.
-- Machines are company-scoped reference data (they move between projects). A
-- machine_log captures one machine on one project on one day: present, hours,
-- breakdown (+note), operator, fuel (per-day total + optional note).
-- Additive + idempotent. RLS: machines = company reference (auth read, pm/office
-- write); machine_logs scoped by project membership.

create table if not exists public.machines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  name text not null,
  code text,                       -- plate / asset number
  kind text,                       -- e.g. excavator, lorry, crane
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.machine_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  machine_id uuid not null references public.machines(id) on delete cascade,
  report_id uuid references public.daily_reports(id) on delete set null,
  log_date date not null,
  present boolean not null default true,
  hours_worked numeric(8, 2),
  breakdown boolean not null default false,
  breakdown_note text,
  operator text,
  fuel_litres numeric(10, 2),      -- per-day total (Stanley's decision)
  fuel_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, machine_id, log_date)  -- one log per machine/project/day
);

-- Indexes ---------------------------------------------------------------------
create index if not exists machines_company_idx on public.machines (company_id);
create index if not exists machine_logs_project_idx
  on public.machine_logs (project_id, log_date desc);

-- updated_at triggers ---------------------------------------------------------
drop trigger if exists machines_touch on public.machines;
create trigger machines_touch before update on public.machines
  for each row execute function public.touch_updated_at();
drop trigger if exists machine_logs_touch on public.machine_logs;
create trigger machine_logs_touch before update on public.machine_logs
  for each row execute function public.touch_updated_at();

-- Row Level Security ----------------------------------------------------------
alter table public.machines     enable row level security;
alter table public.machine_logs enable row level security;

-- Machines: company-wide reference data. Any authenticated user reads; pm/office write.
drop policy if exists "machines_select_auth" on public.machines;
create policy "machines_select_auth" on public.machines
  for select to authenticated using (true);
drop policy if exists "machines_write_office" on public.machines;
create policy "machines_write_office" on public.machines
  for all to authenticated
  using (public.current_user_role() in ('pm', 'office'))
  with check (public.current_user_role() in ('pm', 'office'));

-- Machine logs: project members read and write their project's logs.
drop policy if exists "machine_logs_select_member" on public.machine_logs;
create policy "machine_logs_select_member" on public.machine_logs
  for select using (public.is_project_member(project_id));
drop policy if exists "machine_logs_insert_member" on public.machine_logs;
create policy "machine_logs_insert_member" on public.machine_logs
  for insert to authenticated with check (public.is_project_member(project_id));
drop policy if exists "machine_logs_update_member" on public.machine_logs;
create policy "machine_logs_update_member" on public.machine_logs
  for update using (public.is_project_member(project_id));
drop policy if exists "machine_logs_delete_member" on public.machine_logs;
create policy "machine_logs_delete_member" on public.machine_logs
  for delete using (public.is_project_member(project_id));

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
