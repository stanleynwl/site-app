-- SiteApp — append-only activity log (who did what, when) for the office audit
-- feed. Each meaningful action (report submit, delivery, request create/transition/
-- amend, progress submit, stage complete, stock count) writes one row via the
-- best-effort logActivity helper. No update/delete policies → tamper-resistant.

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,          -- stable key, e.g. 'report.submit', 'request.amend'
  entity_type text,              -- 'report' | 'delivery' | 'request' | 'progress' | 'stage' | 'stock'
  entity_id uuid,                -- optional row link
  detail text,                   -- human data: DO no., item label, "6 → 12 m³"
  created_at timestamptz not null default now()
);

create index if not exists activity_log_project_idx
  on public.activity_log (project_id, created_at desc);
create index if not exists activity_log_created_idx
  on public.activity_log (created_at desc);

alter table public.activity_log enable row level security;

-- Append-only: members may read + insert their project's activity; no update/delete.
drop policy if exists "activity_select_member" on public.activity_log;
create policy "activity_select_member" on public.activity_log
  for select using (public.is_project_member(project_id));

drop policy if exists "activity_insert_member" on public.activity_log;
create policy "activity_insert_member" on public.activity_log
  for insert to authenticated
  with check (public.is_project_member(project_id) and actor_id = auth.uid());

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
