-- SiteApp Phase 1 — projects, membership, daily reports, manpower, issues.
-- Helper functions defined after tables exist; policies use drop-then-create
-- so the migration is safely re-runnable.

-- Enums -----------------------------------------------------------------------
do $$ begin
  create type project_status as enum ('active', 'on_hold', 'completed', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_status as enum ('draft', 'submitted', 'locked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type weather_kind as enum ('sunny', 'cloudy', 'light_rain', 'heavy_rain');
exception when duplicate_object then null; end $$;

do $$ begin
  create type issue_category as enum ('material', 'weather', 'consultant', 'other');
exception when duplicate_object then null; end $$;

-- Tables ----------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  name text not null,
  code text,
  location text,
  start_date date,
  status project_status not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role user_role not null default 'supervisor',
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  report_date date not null,
  author_id uuid references auth.users(id) on delete set null,
  status report_status not null default 'draft',
  weather weather_kind,
  rain_hours numeric(4, 1),
  work_done text,
  notes text,
  submitted_at timestamptz,
  locked_by uuid references auth.users(id) on delete set null,
  edit_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, report_date)
);

create table if not exists public.manpower_entries (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  trade text not null,
  subcontractor text,
  worker_count integer not null default 0 check (worker_count >= 0)
);

create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  description text not null,
  category issue_category not null default 'other',
  severity smallint,
  resolved boolean not null default false
);

create index if not exists daily_reports_project_date_idx
  on public.daily_reports (project_id, report_date desc);
create index if not exists manpower_report_idx on public.manpower_entries (report_id);
create index if not exists issues_report_idx on public.issues (report_id);

-- Helper functions (after tables exist) ---------------------------------------
create or replace function public.current_user_role()
returns user_role language sql security definer stable set search_path = public as $$
  select role from public.profiles where id = auth.uid();

$$;

create or replace function public.is_project_member(p_project uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project and m.user_id = auth.uid()
  );

$$;

create or replace function public.add_creator_as_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null then
    insert into public.project_members (project_id, user_id, role)
    values (new.id, new.created_by, coalesce(public.current_user_role(), 'supervisor'))
    on conflict do nothing;
  end if;
  return new;
end;

$$;

drop trigger if exists projects_add_creator on public.projects;
create trigger projects_add_creator after insert on public.projects
  for each row execute function public.add_creator_as_member();

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

drop trigger if exists daily_reports_touch on public.daily_reports;
create trigger daily_reports_touch before update on public.daily_reports
  for each row execute function public.touch_updated_at();

-- Row Level Security ----------------------------------------------------------
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.daily_reports enable row level security;
alter table public.manpower_entries enable row level security;
alter table public.issues enable row level security;

-- Projects -------------------------------------------------------------------
drop policy if exists "projects_select_member" on public.projects;
create policy "projects_select_member" on public.projects
  for select using (public.is_project_member(id));

drop policy if exists "projects_insert_auth" on public.projects;
create policy "projects_insert_auth" on public.projects
  for insert to authenticated
  with check (public.current_user_role() in ('pm', 'office'));

drop policy if exists "projects_update_pm" on public.projects;
create policy "projects_update_pm" on public.projects
  for update using (
    public.is_project_member(id) and public.current_user_role() in ('pm', 'office')
  );

-- Project members ------------------------------------------------------------
drop policy if exists "project_members_select_member" on public.project_members;
create policy "project_members_select_member" on public.project_members
  for select using (public.is_project_member(project_id));

drop policy if exists "project_members_insert_pm" on public.project_members;
create policy "project_members_insert_pm" on public.project_members
  for insert to authenticated
  with check (
    public.is_project_member(project_id)
    and public.current_user_role() in ('pm', 'office')
  );

-- Daily reports --------------------------------------------------------------
drop policy if exists "daily_reports_select_member" on public.daily_reports;
create policy "daily_reports_select_member" on public.daily_reports
  for select using (public.is_project_member(project_id));

drop policy if exists "daily_reports_insert_member" on public.daily_reports;
create policy "daily_reports_insert_member" on public.daily_reports
  for insert to authenticated
  with check (public.is_project_member(project_id));

drop policy if exists "daily_reports_update_member" on public.daily_reports;
create policy "daily_reports_update_member" on public.daily_reports
  for update using (public.is_project_member(project_id));

-- Manpower entries -----------------------------------------------------------
drop policy if exists "manpower_select_member" on public.manpower_entries;
create policy "manpower_select_member" on public.manpower_entries
  for select using (
    exists (
      select 1 from public.daily_reports dr
      join public.project_members pm on pm.project_id = dr.project_id
      where dr.id = manpower_entries.report_id and pm.user_id = auth.uid()
    )
  );

drop policy if exists "manpower_insert_member" on public.manpower_entries;
create policy "manpower_insert_member" on public.manpower_entries
  for insert to authenticated
  with check (
    exists (
      select 1 from public.daily_reports dr
      join public.project_members pm on pm.project_id = dr.project_id
      where dr.id = manpower_entries.report_id and pm.user_id = auth.uid()
    )
  );

drop policy if exists "manpower_delete_member" on public.manpower_entries;
create policy "manpower_delete_member" on public.manpower_entries
  for delete using (
    exists (
      select 1 from public.daily_reports dr
      join public.project_members pm on pm.project_id = dr.project_id
      where dr.id = manpower_entries.report_id and pm.user_id = auth.uid()
    )
  );

-- Issues ---------------------------------------------------------------------
drop policy if exists "issues_select_member" on public.issues;
create policy "issues_select_member" on public.issues
  for select using (
    exists (
      select 1 from public.daily_reports dr
      join public.project_members pm on pm.project_id = dr.project_id
      where dr.id = issues.report_id and pm.user_id = auth.uid()
    )
  );

drop policy if exists "issues_insert_member" on public.issues;
create policy "issues_insert_member" on public.issues
  for insert to authenticated
  with check (
    exists (
      select 1 from public.daily_reports dr
      join public.project_members pm on pm.project_id = dr.project_id
      where dr.id = issues.report_id and pm.user_id = auth.uid()
    )
  );

drop policy if exists "issues_delete_member" on public.issues;
create policy "issues_delete_member" on public.issues
  for delete using (
    exists (
      select 1 from public.daily_reports dr
      join public.project_members pm on pm.project_id = dr.project_id
      where dr.id = issues.report_id and pm.user_id = auth.uid()
    )
  );<span class="cursor">█</span>