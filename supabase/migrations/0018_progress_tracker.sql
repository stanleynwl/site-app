-- SiteApp Phase 8 redesign — unit-tracked Progress (separate from Stages).
-- Each block gets a unit COUNT (e.g. Block A = 14 units) and a set of progress
-- items seeded from a fixed work-breakdown template (categories A–L, each with
-- leaf items, e.g. "K. FLOOR FINISHES - Toilet & Kitchen tiles"). Site reports
-- how many units are done for each item (cumulative — latest value wins). The
-- office report rolls up units_done / unit_count per item. Stages remain a
-- separate binary tracker (block_stages, migration 0017) — unchanged here except
-- both progress and stages can now carry an optional photo on submit.
-- Additive + idempotent.

-- Block unit count (how many units the block contains). Keeps unit_from/unit_to.
alter table public.project_blocks
  add column if not exists unit_count integer;

-- Progress items — one per leaf of the template, per block. category = the A–L
-- heading; name = the leaf item (null when the category itself is the leaf, e.g.
-- "E. WALL AND PARTITIONS"). units_done = cumulative units completed (0..unit_count).
create table if not exists public.block_progress_items (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.project_blocks(id) on delete cascade,
  category text not null,
  name text,
  sort_order integer not null default 0,
  units_done integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists block_progress_items_block_idx
  on public.block_progress_items (block_id);

-- Optional photo attach: a photo can document a progress item or a stage
-- completion (captured when the supervisor submits). These stay out of the
-- delivery / request photo flows but DO surface in the office gallery + client
-- PDF (getProjectPhotos returns delivery_id IS NULL AND purchase_request_id IS NULL).
alter table public.photos
  add column if not exists progress_item_id uuid
  references public.block_progress_items(id) on delete set null;
alter table public.photos
  add column if not exists block_stage_id uuid
  references public.block_stages(id) on delete set null;

create index if not exists photos_progress_item_idx
  on public.photos (progress_item_id);
create index if not exists photos_block_stage_idx
  on public.photos (block_stage_id);

-- RLS: block_progress_items — access follows the parent block's project. Any
-- member can read + update (site reports units, no approval). Office/pm manage
-- structure (insert/delete) — gated in the action layer; policies allow members
-- to keep it simple and consistent with block_stages.
alter table public.block_progress_items enable row level security;

drop policy if exists "progress_select_member" on public.block_progress_items;
create policy "progress_select_member" on public.block_progress_items
  for select using (
    exists (
      select 1 from public.project_blocks b
      where b.id = block_progress_items.block_id
        and public.is_project_member(b.project_id)
    )
  );

drop policy if exists "progress_insert_member" on public.block_progress_items;
create policy "progress_insert_member" on public.block_progress_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.project_blocks b
      where b.id = block_progress_items.block_id
        and public.is_project_member(b.project_id)
    )
  );

drop policy if exists "progress_update_member" on public.block_progress_items;
create policy "progress_update_member" on public.block_progress_items
  for update using (
    exists (
      select 1 from public.project_blocks b
      where b.id = block_progress_items.block_id
        and public.is_project_member(b.project_id)
    )
  );

drop policy if exists "progress_delete_member" on public.block_progress_items;
create policy "progress_delete_member" on public.block_progress_items
  for delete using (
    exists (
      select 1 from public.project_blocks b
      where b.id = block_progress_items.block_id
        and public.is_project_member(b.project_id)
    )
  );

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
