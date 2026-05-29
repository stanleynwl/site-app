-- SiteApp Phase 8 — project structure: building blocks + per-block stages.
-- Office defines a project's blocks (e.g. "Block A") each with a unit range
-- (e.g. PT 28426 → PT 28439). Each block has an ordered list of construction
-- stages (Foundation / RC structure / Wall / Roofing (water & electric) /
-- Plastering by default, but editable per block). Site marks a stage completed
-- and can add custom items outside the template (painting, fencing, piling).
-- Progress needs NO office approval. Additive + idempotent.

-- Blocks ---------------------------------------------------------------------
create table if not exists public.project_blocks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  unit_from text,
  unit_to text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists project_blocks_project_idx
  on public.project_blocks (project_id);

-- Stages ---------------------------------------------------------------------
-- is_custom = true marks a site-added extra (outside the office template), so we
-- can let the supervisor delete their own additions but not the office stages.
create table if not exists public.block_stages (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.project_blocks(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_custom boolean not null default false,
  completed_at timestamptz,
  completed_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists block_stages_block_idx
  on public.block_stages (block_id);

-- RLS: project_blocks ---------------------------------------------------------
-- Members read; only office/pm define structure (create/edit/delete blocks).
alter table public.project_blocks enable row level security;

drop policy if exists "blocks_select_member" on public.project_blocks;
create policy "blocks_select_member" on public.project_blocks
  for select using (public.is_project_member(project_id));

drop policy if exists "blocks_insert_office" on public.project_blocks;
create policy "blocks_insert_office" on public.project_blocks
  for insert to authenticated
  with check (
    public.is_project_member(project_id)
    and public.current_user_role() in ('pm', 'office')
  );

drop policy if exists "blocks_update_office" on public.project_blocks;
create policy "blocks_update_office" on public.project_blocks
  for update using (
    public.is_project_member(project_id)
    and public.current_user_role() in ('pm', 'office')
  );

drop policy if exists "blocks_delete_office" on public.project_blocks;
create policy "blocks_delete_office" on public.project_blocks
  for delete using (
    public.is_project_member(project_id)
    and public.current_user_role() in ('pm', 'office')
  );

-- RLS: block_stages -----------------------------------------------------------
-- Access follows the parent block's project. Any member can select / insert
-- (office seeds the template, site adds custom) / update (mark complete) /
-- delete (action layer restricts office stages to office). Progress = no approval.
alter table public.block_stages enable row level security;

drop policy if exists "stages_select_member" on public.block_stages;
create policy "stages_select_member" on public.block_stages
  for select using (
    exists (
      select 1 from public.project_blocks b
      where b.id = block_stages.block_id
        and public.is_project_member(b.project_id)
    )
  );

drop policy if exists "stages_insert_member" on public.block_stages;
create policy "stages_insert_member" on public.block_stages
  for insert to authenticated
  with check (
    exists (
      select 1 from public.project_blocks b
      where b.id = block_stages.block_id
        and public.is_project_member(b.project_id)
    )
  );

drop policy if exists "stages_update_member" on public.block_stages;
create policy "stages_update_member" on public.block_stages
  for update using (
    exists (
      select 1 from public.project_blocks b
      where b.id = block_stages.block_id
        and public.is_project_member(b.project_id)
    )
  );

drop policy if exists "stages_delete_member" on public.block_stages;
create policy "stages_delete_member" on public.block_stages
  for delete using (
    exists (
      select 1 from public.project_blocks b
      where b.id = block_stages.block_id
        and public.is_project_member(b.project_id)
    )
  );

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
