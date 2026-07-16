-- SiteApp — subcontractor claim verify/approve workflow + claim photos.
-- Office keys the claim (web office page or the local office app via service
-- role) and attaches photos of the paper original; the SITE supervisor verifies
-- on their phone; a PM approves. The printout shows "Verified by X / Approved
-- by Y". Additive + idempotent.
--
-- Status machine on the existing free-text claims.status column:
--   'draft' -> 'submitted' -> 'verified' -> 'approved'
-- Lines are editable only in draft; office may revert submitted -> draft.
--
-- Verify/approve are SECURITY DEFINER functions rather than UPDATE policies:
-- supervisors are can_site (not can_office), and RLS cannot restrict which
-- columns an UPDATE touches. The functions also stamp the actor's display name
-- onto the row (verified_by_name / approved_by_name) because profiles SELECT is
-- restricted to own-row/admin — a join for full_name would render NULL for most
-- viewers.

-- Claim workflow columns ------------------------------------------------------
alter table public.claims add column if not exists submitted_at     timestamptz;
alter table public.claims add column if not exists verified_by      uuid references auth.users(id) on delete set null;
alter table public.claims add column if not exists verified_at      timestamptz;
alter table public.claims add column if not exists verified_by_name text;
alter table public.claims add column if not exists approved_by      uuid references auth.users(id) on delete set null;
alter table public.claims add column if not exists approved_at      timestamptz;
alter table public.claims add column if not exists approved_by_name text;

-- Photos of the paper claim (stored in the site-photos bucket) -----------------
create table if not exists public.claim_photos (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists claim_photos_claim_idx on public.claim_photos (claim_id);

alter table public.claim_photos enable row level security;

-- Access follows the parent claim's project; pm/office write (0029 shape).
drop policy if exists "claim_photos_select_member" on public.claim_photos;
create policy "claim_photos_select_member" on public.claim_photos
  for select using (
    exists (
      select 1 from public.claims c
      where c.id = claim_photos.claim_id and public.is_project_member(c.project_id)
    )
  );
drop policy if exists "claim_photos_write_office" on public.claim_photos;
create policy "claim_photos_write_office" on public.claim_photos
  for all to authenticated
  using (
    exists (
      select 1 from public.claims c
      where c.id = claim_photos.claim_id
        and public.is_project_member(c.project_id)
        and public.current_user_can_office()
    )
  )
  with check (
    exists (
      select 1 from public.claims c
      where c.id = claim_photos.claim_id
        and public.is_project_member(c.project_id)
        and public.current_user_can_office()
    )
  );

-- Site supervisor verifies a submitted claim -----------------------------------
create or replace function public.verify_claim(p_claim_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_project uuid;
  v_status  text;
begin
  select project_id, status into v_project, v_status
    from claims where id = p_claim_id;
  if v_project is null then
    raise exception 'claim not found';
  end if;
  if not is_project_member(v_project) then
    raise exception 'not a project member';
  end if;
  if not coalesce((select can_site from profiles where id = auth.uid()), false) then
    raise exception 'site access required';
  end if;
  if v_status <> 'submitted' then
    raise exception 'claim is not awaiting verification';
  end if;
  update claims set
    status = 'verified',
    verified_by = auth.uid(),
    verified_at = now(),
    verified_by_name = (select coalesce(nullif(full_name, ''), username)
                          from profiles where id = auth.uid())
  where id = p_claim_id;
end $$;

-- PM approves a verified claim --------------------------------------------------
create or replace function public.approve_claim(p_claim_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_project uuid;
  v_status  text;
  v_role    text;
  v_admin   boolean;
begin
  select project_id, status into v_project, v_status
    from claims where id = p_claim_id;
  if v_project is null then
    raise exception 'claim not found';
  end if;
  if not is_project_member(v_project) then
    raise exception 'not a project member';
  end if;
  select role, is_admin into v_role, v_admin from profiles where id = auth.uid();
  if not (v_role = 'pm' or coalesce(v_admin, false)) then
    raise exception 'pm role required';
  end if;
  if v_status <> 'verified' then
    raise exception 'claim is not verified yet';
  end if;
  update claims set
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = now(),
    approved_by_name = (select coalesce(nullif(full_name, ''), username)
                          from profiles where id = auth.uid())
  where id = p_claim_id;
end $$;

revoke all on function public.verify_claim(uuid)  from public, anon;
revoke all on function public.approve_claim(uuid) from public, anon;
grant execute on function public.verify_claim(uuid)  to authenticated;
grant execute on function public.approve_claim(uuid) to authenticated;

-- Grants (explicit, to avoid the permission-denied trap — see 0004/0006) -------
grant all privileges on all tables    in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
