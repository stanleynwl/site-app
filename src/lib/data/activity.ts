import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Append-only activity log (who did what, when). Actions call logActivity after
// their main write; the office reads a chronological feed per project + globally.

export type ActivityAction =
  | "report.submit"
  | "report.unlock"
  | "delivery.create"
  | "delivery.update"
  | "request.create"
  | "request.approve"
  | "request.reject"
  | "request.order"
  | "request.close"
  | "request.delivered"
  | "request.partial"
  | "request.amend"
  | "progress.submit"
  | "stage.complete"
  | "stage.reopen"
  | "stock.count"
  | "attendance.record"
  | "advance.create"
  | "claim.update"
  | "claim.submit"
  | "claim.verify"
  | "claim.approve"
  | "claim.revert";

export type ActivityEntry = {
  id: string;
  project_id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  detail: string | null;
  created_at: string;
  actor_name: string; // resolved username / full name, else "—"
  project_name?: string | null; // global feed only
};

const COLUMNS =
  "id, project_id, actor_id, action, entity_type, entity_id, detail, created_at";

// Best-effort write — never throw into the parent action. supabase-js returns
// errors in the result (doesn't throw), so a missing table / RLS denial here
// simply skips the log without breaking the action.
export async function logActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entry: {
    projectId: string;
    actorId: string | null;
    action: ActivityAction;
    entityType?: string;
    entityId?: string | null;
    detail?: string | null;
  },
): Promise<void> {
  if (!entry.projectId) return;
  try {
    await supabase.from("activity_log").insert({
      project_id: entry.projectId,
      actor_id: entry.actorId,
      action: entry.action,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      detail: entry.detail ?? null,
    });
  } catch {
    // ignore — logging is non-critical
  }
}

// Resolve actor display names (username / full_name) for a set of rows.
async function attachActorNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: Omit<ActivityEntry, "actor_name">[],
): Promise<ActivityEntry[]> {
  const ids = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
  const nameById = new Map<string, string>();
  if (ids.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, full_name")
      .in("id", ids);
    for (const p of data ?? []) {
      const row = p as { id: string; username: string | null; full_name: string | null };
      nameById.set(row.id, row.full_name || row.username || "—");
    }
  }
  return rows.map((r) => ({
    ...r,
    actor_name: r.actor_id ? nameById.get(r.actor_id) ?? "—" : "—",
  }));
}

// Per-project feed, newest first.
export async function getProjectActivity(
  projectId: string,
  limit = 100,
): Promise<ActivityEntry[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_log")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return attachActorNames(supabase, (data ?? []) as Omit<ActivityEntry, "actor_name">[]);
}

// Office actions on a purchase request — what the site cares to be notified
// about ("the office accepted / ordered your request").
export const REQUEST_OFFICE_ACTIONS = [
  "request.approve",
  "request.reject",
  "request.order",
  "request.close",
] as const;

// Global feed across all the user's projects (project name included). RLS scopes
// rows to the caller's projects, so the site supervisor only sees their own.
// Pass `actions` to filter to specific action codes (e.g. office request actions).
export async function getRecentActivity(
  limit = 100,
  actions?: readonly string[],
): Promise<ActivityEntry[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  let query = supabase
    .from("activity_log")
    .select(`${COLUMNS}, project:projects(name)`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (actions && actions.length > 0) {
    query = query.in("action", actions as string[]);
  }
  const { data } = await query;

  const rows = (data ?? []).map((r) => {
    const { project, ...rest } = r as unknown as Omit<ActivityEntry, "actor_name"> & {
      project: { name: string } | { name: string }[] | null;
    };
    const proj = Array.isArray(project) ? project[0] : project;
    return { ...rest, project_name: proj?.name ?? null };
  });
  return attachActorNames(supabase, rows);
}
