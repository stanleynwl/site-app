import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Phase 8 — project structure. Office defines building blocks (each with a unit
// range, e.g. PT 28426 → PT 28439) and the construction stages on each block.
// Site marks stages complete and adds custom items. Progress needs no approval.

// A photo attached to a structure child (progress item or stage), signed for
// display. Reused as the shape for block reference photos too.
export type StructurePhoto = {
  id: string;
  storage_path: string;
  archived_at: string | null;
  deleted_at?: string | null;
  url?: string | null;
};

export type BlockStage = {
  id: string;
  block_id: string;
  name: string;
  sort_order: number;
  is_custom: boolean;
  completed_at: string | null;
  photos: StructurePhoto[];
};

export type ProgressItem = {
  id: string;
  block_id: string;
  category: string;
  name: string | null;
  sort_order: number;
  units_done: number;
  updated_at: string;
  photos: StructurePhoto[];
};

export type ProjectBlock = {
  id: string;
  project_id: string;
  name: string;
  unit_from: string | null;
  unit_to: string | null;
  unit_count: number | null;
  sort_order: number;
  stages: BlockStage[];
  progress_items: ProgressItem[];
};

const BLOCK_COLUMNS =
  "id, project_id, name, unit_from, unit_to, unit_count, sort_order, stages:block_stages(id, block_id, name, sort_order, is_custom, completed_at, photos!block_stage_id(id, storage_path, archived_at, deleted_at)), progress_items:block_progress_items(id, block_id, category, name, sort_order, units_done, updated_at, photos!progress_item_id(id, storage_path, archived_at, deleted_at))";

export async function getProjectBlocks(
  projectId: string,
): Promise<ProjectBlock[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_blocks")
    .select(BLOCK_COLUMNS)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("sort_order", { referencedTable: "block_stages", ascending: true })
    .order("created_at", { referencedTable: "block_stages", ascending: true })
    .order("sort_order", { referencedTable: "block_progress_items", ascending: true });

  // Drop soft-deleted photos (recoverable for 3 days via the recycle bin).
  const live = (ps: StructurePhoto[] | undefined) =>
    (ps ?? []).filter((p) => !p.deleted_at);
  return ((data ?? []) as unknown as ProjectBlock[]).map((b) => ({
    ...b,
    stages: (b.stages ?? []).map((s) => ({ ...s, photos: live(s.photos) })),
    progress_items: (b.progress_items ?? []).map((p) => ({
      ...p,
      photos: live(p.photos),
    })),
  }));
}

// Sign the progress-item / stage photos on each block (skip archived). Used by
// the office read-only structure view so progress/stage photos show in place.
export async function withSignedStructurePhotos(
  blocks: ProjectBlock[],
): Promise<ProjectBlock[]> {
  if (!isSupabaseConfigured) return blocks;
  const supabase = await createClient();
  const sign = async (p: StructurePhoto): Promise<StructurePhoto> => {
    if (p.archived_at != null) return { ...p, url: null };
    const { data } = await supabase.storage
      .from("site-photos")
      .createSignedUrl(p.storage_path, 3600);
    return { ...p, url: data?.signedUrl ?? null };
  };
  return Promise.all(
    blocks.map(async (b) => ({
      ...b,
      stages: await Promise.all(
        b.stages.map(async (s) => ({ ...s, photos: await Promise.all(s.photos.map(sign)) })),
      ),
      progress_items: await Promise.all(
        b.progress_items.map(async (p) => ({
          ...p,
          photos: await Promise.all(p.photos.map(sign)),
        })),
      ),
    })),
  );
}

// Project-level reference photos (office uploads 1–2 so site recognises the
// project). Shown atop the Progress / Stages screens. is_project_ref flags them
// and keeps them out of the progress gallery.
export type RefPhoto = {
  id: string;
  storage_path: string;
  archived_at: string | null;
  url?: string | null;
};

export async function getProjectRefPhotos(
  projectId: string,
): Promise<RefPhoto[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("photos")
    .select("id, storage_path, archived_at")
    .eq("project_id", projectId)
    .eq("is_project_ref", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const photos = (data ?? []) as RefPhoto[];
  return Promise.all(
    photos.map(async (p) => {
      if (p.archived_at != null) return { ...p, url: null };
      const { data: signed } = await supabase.storage
        .from("site-photos")
        .createSignedUrl(p.storage_path, 3600);
      return { ...p, url: signed?.signedUrl ?? null };
    }),
  );
}

// Group a block's progress items by category for display. Groups by category
// KEY (in first-seen order), not consecutive runs, so an item appended with a
// high sort_order still lands inside its category group rather than forming a
// stray duplicate heading at the bottom. (Items already arrive sorted by
// sort_order, so seeded template data is unaffected.)
export function groupProgressByCategory(
  items: ProgressItem[],
): { category: string; items: ProgressItem[] }[] {
  const out: { category: string; items: ProgressItem[] }[] = [];
  const byCategory = new Map<string, ProgressItem[]>();
  for (const it of items) {
    let bucket = byCategory.get(it.category);
    if (!bucket) {
      bucket = [];
      byCategory.set(it.category, bucket);
      out.push({ category: it.category, items: bucket });
    }
    bucket.push(it);
  }
  return out;
}

// The furthest-along completed stage on a block (highest sort_order among
// completed; tie-break by completed_at). Null when nothing is completed. Used
// for the office Stages summary ("Block A — RC structure completed").
export function latestCompletedStage(block: ProjectBlock): BlockStage | null {
  const done = block.stages.filter((s) => s.completed_at != null);
  if (done.length === 0) return null;
  return done.reduce((best, s) =>
    s.sort_order > best.sort_order ||
    (s.sort_order === best.sort_order &&
      (s.completed_at ?? "") > (best.completed_at ?? ""))
      ? s
      : best,
  );
}

// The most-recently-updated progress item with any units done (max updated_at).
// Null when nothing has progress. Used for the office Progress summary line.
export function latestProgressItem(block: ProjectBlock): ProgressItem | null {
  const started = block.progress_items.filter((p) => p.units_done > 0);
  if (started.length === 0) return null;
  return started.reduce((best, p) =>
    p.updated_at > best.updated_at ? p : best,
  );
}

// "New" = the site updated something after the office's last-seen marker (or the
// marker is null and there's any activity). Compared against project.*_seen_at.
export function hasNewStages(
  block: ProjectBlock,
  seenAt: string | null,
): boolean {
  return block.stages.some(
    (s) => s.completed_at != null && (seenAt == null || s.completed_at > seenAt),
  );
}

export function hasNewProgress(
  block: ProjectBlock,
  seenAt: string | null,
): boolean {
  return block.progress_items.some(
    (p) => p.units_done > 0 && (seenAt == null || p.updated_at > seenAt),
  );
}

// Lightweight bulk check for the office dashboard: returns which project IDs
// have new progress or stages since the office's last-seen marker. Two queries
// total regardless of project count (RLS already scopes to visible data).
export async function getProjectIdsWithNewStructure(
  projects: { id: string; progress_seen_at: string | null; stages_seen_at: string | null }[],
): Promise<{ newProgress: Set<string>; newStages: Set<string> }> {
  const empty = { newProgress: new Set<string>(), newStages: new Set<string>() };
  if (!isSupabaseConfigured || projects.length === 0) return empty;

  const seenMap = new Map(
    projects.map((p) => [p.id, { progress: p.progress_seen_at, stages: p.stages_seen_at }]),
  );
  const supabase = await createClient();

  const [{ data: progressRows }, { data: stageRows }] = await Promise.all([
    supabase
      .from("block_progress_items")
      .select("updated_at, project_blocks!inner(project_id)")
      .gt("units_done", 0),
    supabase
      .from("block_stages")
      .select("completed_at, project_blocks!inner(project_id)")
      .not("completed_at", "is", null),
  ]);

  const newProgress = new Set<string>();
  const newStages = new Set<string>();

  for (const row of progressRows ?? []) {
    const projectId = (row.project_blocks as unknown as { project_id: string }).project_id;
    const seen = seenMap.get(projectId);
    if (!seen) continue;
    if (seen.progress == null || row.updated_at > seen.progress) newProgress.add(projectId);
  }
  for (const row of stageRows ?? []) {
    const projectId = (row.project_blocks as unknown as { project_id: string }).project_id;
    const seen = seenMap.get(projectId);
    if (!seen) continue;
    const ca = row.completed_at ?? "";
    if (seen.stages == null || ca > seen.stages) newStages.add(projectId);
  }

  return { newProgress, newStages };
}

// Block-level progress %: average of each item's units_done / unit_count.
// Returns null when there's no unit_count or no items (nothing to measure).
export function blockProgressPercent(block: ProjectBlock): number | null {
  const total = block.unit_count ?? 0;
  if (total <= 0 || block.progress_items.length === 0) return null;
  const sum = block.progress_items.reduce(
    (acc, it) => acc + Math.min(1, (it.units_done ?? 0) / total),
    0,
  );
  return Math.round((sum / block.progress_items.length) * 100);
}
