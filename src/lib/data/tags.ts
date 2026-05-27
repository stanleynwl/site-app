import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { ProjectTag } from "./tag-kinds";

// Per-project photo taxonomy (Phase 2). Tags are grouped by `kind`
// (block / level / area / activity), editable mid-project. Project members may
// read all tags and suggest new ones (approved=false); pm/office approve and
// delete (enforced by RLS in migration 0006).
//
// The pure constants/types live in tag-kinds.ts (client-safe); re-exported here
// so server callers can import everything from one place.
export { TAG_KINDS } from "./tag-kinds";
export type { TagKind, ProjectTag } from "./tag-kinds";

export async function getProjectTags(projectId: string): Promise<ProjectTag[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_tags")
    .select("id, kind, label, approved")
    .eq("project_id", projectId)
    .order("kind")
    .order("label");
  return (data ?? []) as ProjectTag[];
}
