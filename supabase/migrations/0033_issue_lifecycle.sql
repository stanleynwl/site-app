-- #11 Issue lifecycle — give daily-report issues an owner + an open/closed
-- status so problems are tracked to closure (the Procore/Autodesk gap), not just
-- logged as flat text lines nobody owns.
--
-- Lifecycle state lives on the issues row. saveReport now MERGES issues by id
-- (update existing / insert new / delete removed) instead of delete-all+insert,
-- so an assignee or a closed status the office set survives a same-day report
-- edit by the supervisor.
--
-- Apply-before-deploy: the read layer (reports.ts `issues(... assigned_to,
-- closed_at, assignee:profiles!issues_assigned_to_fkey(username))`) selects
-- these columns, so this migration MUST be applied before the code deploys.

alter table public.issues
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
  add column if not exists closed_at  timestamptz,
  add column if not exists closed_by  uuid references public.profiles(id) on delete set null;

-- Open issues are the hot query (the office cross-project triage list). Partial
-- index keeps it cheap as closed issues accumulate.
create index if not exists issues_open_idx on public.issues (report_id) where closed_at is null;
create index if not exists issues_assigned_idx on public.issues (assigned_to);

-- Members may UPDATE issues (assign / close / reopen). The 0002 policies only
-- covered select/insert/delete — without this, lifecycle writes are silently
-- rejected by RLS. Office users are members of every project (0025), so this
-- grants them triage rights; the assign/close controls are office-only in the
-- UI. Mirrors the member-scoped check the other issue policies use.
drop policy if exists "issues_update_member" on public.issues;
create policy "issues_update_member" on public.issues
  for update using (
    exists (
      select 1 from public.daily_reports dr
      join public.project_members pm on pm.project_id = dr.project_id
      where dr.id = issues.report_id and pm.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.daily_reports dr
      join public.project_members pm on pm.project_id = dr.project_id
      where dr.id = issues.report_id and pm.user_id = auth.uid()
    )
  );

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
