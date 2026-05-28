-- SiteApp Phase 5 (operations) — visitors on the daily report.
-- A secondary, optional daily-report section (like issues): who visited site
-- and why (consultant, client, inspector…). Visitors do NOT pre-fill from
-- yesterday (per the report pre-fill policy). Additive + idempotent.
-- RLS mirrors manpower_entries (access via the parent report's project).

create table if not exists public.visitor_entries (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  name text not null,
  purpose text,
  created_at timestamptz not null default now()
);

create index if not exists visitor_report_idx
  on public.visitor_entries (report_id);

alter table public.visitor_entries enable row level security;

drop policy if exists "visitor_select_member" on public.visitor_entries;
create policy "visitor_select_member" on public.visitor_entries
  for select using (
    exists (
      select 1 from public.daily_reports dr
      join public.project_members pm on pm.project_id = dr.project_id
      where dr.id = visitor_entries.report_id and pm.user_id = auth.uid()
    )
  );

drop policy if exists "visitor_insert_member" on public.visitor_entries;
create policy "visitor_insert_member" on public.visitor_entries
  for insert to authenticated
  with check (
    exists (
      select 1 from public.daily_reports dr
      join public.project_members pm on pm.project_id = dr.project_id
      where dr.id = visitor_entries.report_id and pm.user_id = auth.uid()
    )
  );

drop policy if exists "visitor_delete_member" on public.visitor_entries;
create policy "visitor_delete_member" on public.visitor_entries
  for delete using (
    exists (
      select 1 from public.daily_reports dr
      join public.project_members pm on pm.project_id = dr.project_id
      where dr.id = visitor_entries.report_id and pm.user_id = auth.uid()
    )
  );

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
