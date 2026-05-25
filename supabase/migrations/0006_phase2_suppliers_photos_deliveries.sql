-- SiteApp Phase 2 — managed suppliers, materials, photo taxonomy, photos,
-- and the three-quantity delivery model. Schema only (UI built incrementally).
-- Additive and idempotent. Photo binaries live in Supabase Storage; this defines
-- the metadata. RLS scopes project data by membership; suppliers/materials are
-- company-wide reference data. Grants included to avoid the permission-denied
-- trap (see 0004) for tables created here.

-- Enums -----------------------------------------------------------------------
do $$ begin
  create type tag_kind as enum ('block', 'level', 'area', 'activity');
exception when duplicate_object then null; end $$;

-- Suppliers (managed list — decided 2026-05-25; company-scoped) ----------------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  name text not null,
  code text,
  phone text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Materials catalog. count_required drives whether the supervisor is shown the
-- received-quantity field at delivery (see deliveries.received_quantity).
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  name text not null,
  unit text,                       -- e.g. 'm3', 'tonne', 'bag', 'pcs'
  count_required boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Per-project photo taxonomy. Supervisors may suggest tags (approved=false);
-- office approves them (approved=true). Editable mid-project.
create table if not exists public.project_tags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind tag_kind not null,
  label text not null,
  approved boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, kind, label)
);

-- Photos — metadata only; the image lives in a Supabase Storage bucket.
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  report_id uuid references public.daily_reports(id) on delete set null,
  storage_path text not null,      -- path within the storage bucket
  caption text,
  taken_at timestamptz,            -- from EXIF when available
  gps_lat double precision,
  gps_lng double precision,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Photo <-> tag association.
create table if not exists public.photo_tags (
  photo_id uuid not null references public.photos(id) on delete cascade,
  tag_id   uuid not null references public.project_tags(id) on delete cascade,
  primary key (photo_id, tag_id)
);

-- Deliveries — three-quantity model captured by three parties at three points.
create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  report_id uuid references public.daily_reports(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  material_id uuid references public.materials(id) on delete set null,
  material_text text,              -- fallback when material not in the catalog
  do_number text,
  do_photo_id uuid references public.photos(id) on delete set null,
  unit text,
  requested_quantity numeric(12, 3),  -- from purchase request (Phase 4)
  do_quantity numeric(12, 3),         -- office data entry from the DO photo
  received_quantity numeric(12, 3),   -- supervisor at delivery (count_required only)
  -- Forward-looking per Design Principle #4: FK constraint to purchase_requests
  -- is added in Phase 4 when that table exists. Kept as a plain nullable uuid now.
  purchase_request_id uuid,
  delivered_on date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Indexes ---------------------------------------------------------------------
create index if not exists suppliers_company_idx on public.suppliers (company_id);
create index if not exists project_tags_project_idx on public.project_tags (project_id, kind);
create index if not exists photos_project_idx on public.photos (project_id, created_at desc);
create index if not exists photos_report_idx on public.photos (report_id);
create index if not exists deliveries_project_idx on public.deliveries (project_id, delivered_on desc);
create index if not exists deliveries_report_idx on public.deliveries (report_id);

-- updated_at trigger for suppliers --------------------------------------------
drop trigger if exists suppliers_touch on public.suppliers;
create trigger suppliers_touch before update on public.suppliers
  for each row execute function public.touch_updated_at();

-- Row Level Security ----------------------------------------------------------
alter table public.suppliers     enable row level security;
alter table public.materials     enable row level security;
alter table public.project_tags  enable row level security;
alter table public.photos        enable row level security;
alter table public.photo_tags    enable row level security;
alter table public.deliveries    enable row level security;

-- Suppliers / materials: company-wide reference data. Any authenticated user
-- may read; only pm/office may write.
drop policy if exists "suppliers_select_auth" on public.suppliers;
create policy "suppliers_select_auth" on public.suppliers
  for select to authenticated using (true);
drop policy if exists "suppliers_write_office" on public.suppliers;
create policy "suppliers_write_office" on public.suppliers
  for all to authenticated
  using (public.current_user_role() in ('pm', 'office'))
  with check (public.current_user_role() in ('pm', 'office'));

drop policy if exists "materials_select_auth" on public.materials;
create policy "materials_select_auth" on public.materials
  for select to authenticated using (true);
drop policy if exists "materials_write_office" on public.materials;
create policy "materials_write_office" on public.materials
  for all to authenticated
  using (public.current_user_role() in ('pm', 'office'))
  with check (public.current_user_role() in ('pm', 'office'));

-- Project tags: members read; members may suggest (insert); pm/office approve/update/delete.
drop policy if exists "project_tags_select_member" on public.project_tags;
create policy "project_tags_select_member" on public.project_tags
  for select using (public.is_project_member(project_id));
drop policy if exists "project_tags_insert_member" on public.project_tags;
create policy "project_tags_insert_member" on public.project_tags
  for insert to authenticated with check (public.is_project_member(project_id));
drop policy if exists "project_tags_update_office" on public.project_tags;
create policy "project_tags_update_office" on public.project_tags
  for update using (
    public.is_project_member(project_id) and public.current_user_role() in ('pm', 'office')
  );
drop policy if exists "project_tags_delete_office" on public.project_tags;
create policy "project_tags_delete_office" on public.project_tags
  for delete using (
    public.is_project_member(project_id) and public.current_user_role() in ('pm', 'office')
  );

-- Photos: project members may read and write (insert/update/delete) their project's photos.
drop policy if exists "photos_select_member" on public.photos;
create policy "photos_select_member" on public.photos
  for select using (public.is_project_member(project_id));
drop policy if exists "photos_insert_member" on public.photos;
create policy "photos_insert_member" on public.photos
  for insert to authenticated with check (public.is_project_member(project_id));
drop policy if exists "photos_update_member" on public.photos;
create policy "photos_update_member" on public.photos
  for update using (public.is_project_member(project_id));
drop policy if exists "photos_delete_member" on public.photos;
create policy "photos_delete_member" on public.photos
  for delete using (public.is_project_member(project_id));

-- Photo tags: access follows the parent photo's project membership.
drop policy if exists "photo_tags_select_member" on public.photo_tags;
create policy "photo_tags_select_member" on public.photo_tags
  for select using (
    exists (
      select 1 from public.photos ph
      where ph.id = photo_tags.photo_id and public.is_project_member(ph.project_id)
    )
  );
drop policy if exists "photo_tags_write_member" on public.photo_tags;
create policy "photo_tags_write_member" on public.photo_tags
  for all to authenticated
  using (
    exists (
      select 1 from public.photos ph
      where ph.id = photo_tags.photo_id and public.is_project_member(ph.project_id)
    )
  )
  with check (
    exists (
      select 1 from public.photos ph
      where ph.id = photo_tags.photo_id and public.is_project_member(ph.project_id)
    )
  );

-- Deliveries: project members read and write their project's deliveries.
drop policy if exists "deliveries_select_member" on public.deliveries;
create policy "deliveries_select_member" on public.deliveries
  for select using (public.is_project_member(project_id));
drop policy if exists "deliveries_insert_member" on public.deliveries;
create policy "deliveries_insert_member" on public.deliveries
  for insert to authenticated with check (public.is_project_member(project_id));
drop policy if exists "deliveries_update_member" on public.deliveries;
create policy "deliveries_update_member" on public.deliveries
  for update using (public.is_project_member(project_id));
drop policy if exists "deliveries_delete_member" on public.deliveries;
create policy "deliveries_delete_member" on public.deliveries
  for delete using (public.is_project_member(project_id));

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
