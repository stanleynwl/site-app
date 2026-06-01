-- SiteApp Phase 10 — per-user area access + admin user management.
-- Adds explicit access flags so an admin can grant a user OFFICE, SITE, or BOTH,
-- independent of their role; and an is_admin flag for who may manage users.
-- The existing pm account(s) become admin (Stanley); future pm users are NOT
-- admin by default. Additive + idempotent.

alter table public.profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists can_office boolean not null default false,
  add column if not exists can_site boolean not null default false;

-- Backfill access from current role so nobody loses access on deploy:
--   supervisor → site only · office/pm → office + site.
update public.profiles set can_site = true  where role = 'supervisor';
update public.profiles set can_office = true, can_site = true where role in ('office', 'pm');
-- Existing pm accounts become the admin(s); future pm users default is_admin=false.
update public.profiles set is_admin = true where role = 'pm';

-- Helper: is the current user an admin? security definer to read profiles.
create or replace function public.current_user_is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- RLS: admins can read and update ANY profile (to list users + set access/role).
-- (Base policies still allow every user to read/update their own row.)
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select using (public.current_user_is_admin());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
grant all privileges on all functions in schema public
  to anon, authenticated, service_role;
