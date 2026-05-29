import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Phase 8 — project structure. Office defines building blocks (each with a unit
// range, e.g. PT 28426 → PT 28439) and the construction stages on each block.
// Site marks stages complete and adds custom items. Progress needs no approval.

export type BlockStage = {
  id: string;
  block_id: string;
  name: string;
  sort_order: number;
  is_custom: boolean;
  completed_at: string | null;
};

export type ProgressItem = {
  id: string;
  block_id: string;
  category: string;
  name: string | null;
  sort_order: number;
  units_done: number;
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
  "id, project_id, name, unit_from, unit_to, unit_count, sort_order, stages:block_stages(id, block_id, name, sort_order, is_custom, completed_at), progress_items:block_progress_items(id, block_id, category, name, sort_order, units_done)";

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

  return ((data ?? []) as unknown as ProjectBlock[]).map((b) => ({
    ...b,
    stages: b.stages ?? [],
    progress_items: b.progress_items ?? [],
  }));
}

// Group a block's progress items by category, preserving template order, for
// display. (Items already arrive sorted by sort_order.)
export function groupProgressByCategory(
  items: ProgressItem[],
): { category: string; items: ProgressItem[] }[] {
  const out: { category: string; items: ProgressItem[] }[] = [];
  for (const it of items) {
    const last = out[out.length - 1];
    if (last && last.category === it.category) last.items.push(it);
    else out.push({ category: it.category, items: [it] });
  }
  return out;
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
