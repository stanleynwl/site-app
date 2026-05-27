import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Phase 4 — purchase requests (capture-only procurement). Supervisor raises a
// request; office works it through a state machine and captures the PO number
// (the PO itself is issued outside the app). Linking a delivery to a request
// closes the three-quantity variance loop.

export type PurchaseRequestStatus =
  | "pending"
  | "approved"
  | "po_issued"
  | "delivered"
  | "closed"
  | "rejected";

// "Open" = still needs office attention / not finished. Used for the queue and
// for which requests a delivery can be linked to.
export const PR_OPEN_STATUSES: PurchaseRequestStatus[] = [
  "pending",
  "approved",
  "po_issued",
];

export type PurchaseRequest = {
  id: string;
  project_id: string;
  material_text: string | null;
  material: { name: string; unit: string | null } | null;
  quantity: number | null;
  unit: string | null;
  needed_by: string | null;
  urgency_reason: string | null;
  note: string | null;
  status: PurchaseRequestStatus;
  supplier: { name: string } | null;
  po_number: string | null;
  rejected_reason: string | null;
  created_at: string;
  project?: { name: string } | null; // set only in the cross-project queue
};

const PR_COLUMNS =
  "id, project_id, material_text, quantity, unit, needed_by, urgency_reason, note, status, po_number, rejected_reason, created_at, material:materials(name, unit), supplier:suppliers(name)";

export async function getProjectPurchaseRequests(
  projectId: string,
): Promise<PurchaseRequest[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchase_requests")
    .select(PR_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as PurchaseRequest[];
}

// Office queue: open requests across all the user's projects, oldest first so
// the longest-waiting ones surface at the top (aging is derived in the view).
export async function getOpenPurchaseRequests(): Promise<PurchaseRequest[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchase_requests")
    .select(`${PR_COLUMNS}, project:projects(name)`)
    .in("status", PR_OPEN_STATUSES)
    .order("created_at", { ascending: true });
  return (data ?? []) as unknown as PurchaseRequest[];
}

export function prMaterialName(r: PurchaseRequest): string {
  return r.material?.name ?? r.material_text ?? "—";
}

// Whole hours a request has been waiting since it was raised — for aging colour.
export function prAgeHours(r: PurchaseRequest): number {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(r.created_at).getTime()) / 3_600_000),
  );
}
