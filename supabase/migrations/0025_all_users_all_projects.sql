-- SiteApp — "everyone sees everything" membership model.
-- Projects are gated by public.project_members (RLS). To make every user see
-- every project without rewriting policies across all tables, we keep the
-- membership model but ensure every (project, user) pair exists: backfill now,
-- and maintain it with triggers on new projects and new profiles.
-- Pure data + triggers (no columns the read layer selects) -> no lockout risk.

-- 1) Backfill: add every existing user to every existing project.
insert into public.project_members (project_id, user_id, role)
select p.id, pr.id, coalesce(pr.role, 'supervisor')
from public.projects p
cross join public.profiles pr
on conflict do nothing;

-- 2) New project -> add ALL existing users (replaces the creator-only trigger).
create or replace function public.add_all_members_to_project()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_members (project_id, user_id, role)
  select new.id, pr.id, coalesce(pr.role, 'supervisor')
  from public.profiles pr
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists projects_add_creator on public.projects;
drop trigger if exists projects_add_all_members on public.projects;
create trigger projects_add_all_members after insert on public.projects
  for each row execute function public.add_all_members_to_project();

-- 3) New profile (every new login) -> add to ALL existing projects.
create or replace function public.add_member_to_all_projects()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_members (project_id, user_id, role)
  select p.id, new.id, coalesce(new.role, 'supervisor')
  from public.projects p
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_add_all_projects on public.profiles;
create trigger profiles_add_all_projects after insert on public.profiles
  for each row execute function public.add_member_to_all_projects();
