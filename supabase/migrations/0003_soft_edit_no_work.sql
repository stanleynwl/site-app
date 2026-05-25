-- SiteApp Phase 1 additions — soft-edit window, no_work report type, audit log.
-- Additive only: no destructive changes to existing tables or data.
-- Safe to run against current Supabase state even before Phase 1 e2e is verified.

-- Enums -----------------------------------------------------------------------
do $$ begin
  create type report_type as enum ('normal', 'no_work');
exception when duplicate_object then null; end $$;

do $$ begin
  create type no_work_reason as enum ('holiday', 'weather', 'site_closed', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type edit_kind as enum ('soft_window', 'pm_unlock');
exception when duplicate_object then null; end $$;

-- Extend daily_reports --------------------------------------------------------
alter table public.daily_reports
  add column if not exists report_type report_type not null default 'normal',
  add column if not exists no_work_reason no_work_reason,
  add column if not exists unlocked_by uuid references auth.users(id) on delete set null,
  add column if not exists unlock_reason text;

-- Audit table for soft-window edits and PM unlocks ----------------------------
create table if not exists public.report_edits (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.daily_reports(id) on delete cascade,
  editor_id   uuid references auth.users(id) on delete set null,
  kind        edit_kind not null default 'soft_window',
  edited_at   timestamptz not null default now()
);

create index if not exists report_edits_report_idx on public.report_edits (report_id, edited_at desc);

-- RLS for report_edits --------------------------------------------------------
alter table public.report_edits enable row level security;

-- Project members can read the audit trail for their projects.
drop policy if exists "report_edits_select_member" on public.report_edits;
create policy "report_edits_select_member" on public.report_edits
  for select using (
    exists (
      select 1 from public.daily_reports dr
      join public.project_members pm on pm.project_id = dr.project_id
      where dr.id = report_edits.report_id and pm.user_id = auth.uid()
    )
  );

-- The server action inserts audit rows; the editor_id must match the caller.
drop policy if exists "report_edits_insert_self" on public.report_edits;
create policy "report_edits_insert_self" on public.report_edits
  for insert to authenticated
  with check (
    auth.uid() = editor_id
    and exists (
      select 1 from public.daily_reports dr
      join public.project_members pm on pm.project_id = dr.project_id
      where dr.id = report_edits.report_id and pm.user_id = auth.uid()
    )
  );

-- Down (manual rollback if needed — not auto-applied) -------------------------
-- alter table public.daily_reports drop column if exists report_type;
-- alter table public.daily_reports drop column if exists no_work_reason;
-- alter table public.daily_reports drop column if exists unlocked_by;
-- alter table public.daily_reports drop column if exists unlock_reason;
-- drop table if exists public.report_edits;
-- drop type if exists edit_kind;
-- drop type if exists no_work_reason;
-- drop type if exists report_type;
