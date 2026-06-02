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

// A delivered request lingers on the supervisor's list for this many days after
// delivery (so they can still see what recently arrived), then drops off.
export const DELIVERED_HOLD_DAYS = 5;

export type PurchaseRequestItem = {
  id: string;
  material_text: string | null;
  material: { name: string; unit: string | null } | null;
  quantity: number | null;
  unit: string | null;
};

export type RequestPhoto = {
  id: string;
  storage_path: string;
  archived_at: string | null;
  url?: string | null; // resolved by withSignedRequestPhotos
};

export type PurchaseRequest = {
  id: string;
  project_id: string;
  needed_by: string | null;
  urgency_reason: string | null;
  note: string | null;
  status: PurchaseRequestStatus;
  supplier: { name: string } | null;
  po_number: string | null;
  rejected_reason: string | null;
  created_at: string;
  delivered_at: string | null;
  items: PurchaseRequestItem[];
  photos: RequestPhoto[];
  project?: { name: string } | null; // set only in the cross-project queue
};

const PR_COLUMNS =
  "id, project_id, needed_by, urgency_reason, note, status, po_number, rejected_reason, created_at, delivered_at, supplier:suppliers(name), items:purchase_request_items(id, material_text, quantity, unit, material:materials(name, unit)), photos(id, storage_path, archived_at)";

// Requests the supervisor should see on the site list: all open ones, plus
// delivered ones for a short hold window (DELIVERED_HOLD_DAYS) after delivery.
export function isVisibleToSite(r: PurchaseRequest): boolean {
  if (PR_OPEN_STATUSES.includes(r.status)) return true;
  if (r.status === "delivered" && r.delivered_at) {
    const ageMs = Date.now() - new Date(r.delivered_at).getTime();
    return ageMs <= DELIVERED_HOLD_DAYS * 86_400_000;
  }
  return false;
}

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

export function itemName(item: PurchaseRequestItem): string {
  return item.material?.name ?? item.material_text ?? "—";
}

// Short one-line label for a request's items: "Timber 1x2 (50), Timber 2x3 (30)".
export function prItemsLabel(r: PurchaseRequest): string {
  if (r.items.length === 0) return "—";
  return r.items
    .map((i) => {
      const q = i.quantity != null ? ` (${i.quantity}${i.unit ? ` ${i.unit}` : ""})` : "";
      return `${itemName(i)}${q}`;
    })
    .join(", ");
}

// Whole hours a request has been waiting since it was raised — for aging colour.
export function prAgeHours(r: PurchaseRequest): number {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(r.created_at).getTime()) / 3_600_000),
  );
}

// Resolve short-lived signed URLs for each request's photos (skip archived ones,
// whose binaries have moved to the local archive). Mirrors withSignedPhotoUrls.
export async function withSignedRequestPhotos(
  requests: PurchaseRequest[],
): Promise<PurchaseRequest[]> {
  if (!isSupabaseConfigured) return requests;
  const supabase = await createClient();
  return Promise.all(
    requests.map(async (r) => ({
      ...r,
      photos: await Promise.all(
        r.photos.map(async (p) => {
          if (p.archived_at != null) return { ...p, url: null };
          const { data } = await supabase.storage
            .from("site-photos")
            .createSignedUrl(p.storage_path, 3600);
          return { ...p, url: data?.signedUrl ?? null };
        }),
      ),
    })),
  );
}
