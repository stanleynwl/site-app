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

export type ProjectBlock = {
  id: string;
  project_id: string;
  name: string;
  unit_from: string | null;
  unit_to: string | null;
  sort_order: number;
  stages: BlockStage[];
};

const BLOCK_COLUMNS =
  "id, project_id, name, unit_from, unit_to, sort_order, stages:block_stages(id, block_id, name, sort_order, is_custom, completed_at)";

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
    .order("created_at", { referencedTable: "block_stages", ascending: true });

  return ((data ?? []) as unknown as ProjectBlock[]).map((b) => ({
    ...b,
    stages: b.stages ?? [],
  }));
}
