-- SiteApp Phase 5 (revised) — machinery moves INTO the daily report.
-- Per Stanley: machinery is a daily-report section like manpower. One row =
-- one machine + hours worked; two of the same type on different hours (one
-- broke down) are just two rows (backhoe 8h + backhoe 4h).
--
-- This REPLACES the standalone machinery feature from 0010 — the unused
-- `machines` + `machine_logs` tables are dropped (they were brand-new, no real
-- data). Additive otherwise + idempotent. RLS mirrors manpower_entries.

-- Drop the obsolete standalone machinery tables (0010). machine_logs first (FK).
drop table if exists public.machine_logs;
drop table if exists public.machines;

-- Report-linked machinery entries (mirrors manpower_entries).
create table if not exists public.machinery_entries (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  machine_type text not null,         -- canonical English or free text
  hours_worked numeric(6, 2),
  created_at timestamptz not null default now()
);

create index if not exists machinery_report_idx
  on public.machinery_entries (report_id);

-- Row Level Security — access follows the parent report's project membership.
alter table public.machinery_entries enable row level security;

drop policy if exists "machinery_select_member" on public.machinery_entries;
create policy "machinery_select_member" on public.machinery_entries
  for select using (
    exists (
      select 1 from public.daily_reports dr
      join public.project_members pm on pm.project_id = dr.project_id
      where dr.id = machinery_entries.report_id and pm.user_id = auth.uid()
    )
  );

drop policy if exists "machinery_insert_member" on public.machinery_entries;
create policy "machinery_insert_member" on public.machinery_entries
  for insert to authenticated
  with check (
    exists (
      select 1 from public.daily_reports dr
      join public.project_members pm on pm.project_id = dr.project_id
      where dr.id = machinery_entries.report_id and pm.user_id = auth.uid()
    )
  );

drop policy if exists "machinery_delete_member" on public.machinery_entries;
create policy "machinery_delete_member" on public.machinery_entries
  for delete using (
    exists (
      select 1 from public.daily_reports dr
      join public.project_members pm on pm.project_id = dr.project_id
      where dr.id = machinery_entries.report_id and pm.user_id = auth.uid()
    )
  );

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
