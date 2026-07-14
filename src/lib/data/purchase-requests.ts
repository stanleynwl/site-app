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
  | "partial" // some of the order arrived (via DO capture); more coming
  | "delivered"
  | "closed"
  | "rejected";

// "Open" = still needs office attention / not finished. Used for the queue and
// for which requests a delivery can be linked to.
export const PR_OPEN_STATUSES: PurchaseRequestStatus[] = [
  "pending",
  "approved",
  "po_issued",
  "partial",
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
  spec: string | null; // free-text size/spec, e.g. timber "12 ft · 4 tonne"
  delivered_quantity: number | null; // cumulative received across DOs; null = never counted
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
  ordered_at: string | null;
  delivered_at: string | null;
  items: PurchaseRequestItem[];
  photos: RequestPhoto[];
  project?: { name: string } | null; // set only in the cross-project queue
};

const PR_COLUMNS =
  "id, project_id, needed_by, urgency_reason, note, status, po_number, rejected_reason, created_at, ordered_at, delivered_at, supplier:suppliers(name), items:purchase_request_items(id, material_text, quantity, unit, spec, delivered_quantity, material:materials(name, unit)), photos(id, storage_path, archived_at)";

// Requests still worth showing: all open ones, plus delivered ones for a short
// hold window (DELIVERED_HOLD_DAYS) after delivery. Used by BOTH the supervisor's
// site list and the office queue so they drop off together.
export function isRequestVisible(r: PurchaseRequest): boolean {
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

// Office queue: open requests across all the user's projects (newest first so
// the latest requests surface at the top), plus recently delivered ones kept
// for the hold window — same visibility as the supervisor's site list.
export async function getOpenPurchaseRequests(): Promise<PurchaseRequest[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchase_requests")
    .select(`${PR_COLUMNS}, project:projects(name)`)
    .in("status", [...PR_OPEN_STATUSES, "delivered"])
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as PurchaseRequest[];
  return rows.filter(isRequestVisible);
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
      const s = i.spec ? ` — ${i.spec}` : "";
      return `${itemName(i)}${q}${s}`;
    })
    .join(", ");
}

// Whole hours a request waited for office action — for aging colour. The clock
// stops once the office orders it (ordered_at); it does not keep ticking while
// the request sits with the supplier/site. Falls back to delivered_at for any
// older row missing ordered_at, otherwise counts up to now.
export function prAgeHours(r: PurchaseRequest): number {
  const stop = r.ordered_at ?? r.delivered_at;
  const end = stop ? new Date(stop).getTime() : Date.now();
  return Math.max(0, Math.floor((end - new Date(r.created_at).getTime()) / 3_600_000));
}

// --- Materials procurement register (office archive) ------------------------
// Whole days between two timestamps (rounded), or null if either is missing.
// Used for lead-time columns: requested→ordered, ordered→delivered, etc.
export function daysBetween(
  fromIso: string | null,
  toIso: string | null,
): number | null {
  if (!fromIso || !toIso) return null;
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

// A request is "outstanding" while it still needs the supplier/site to deliver —
// i.e. not yet delivered and not rejected/closed.
export function prIsOutstanding(r: PurchaseRequest): boolean {
  return r.status !== "delivered" && r.status !== "rejected" && r.status !== "closed";
}

// Overdue = still outstanding AND its needed-by date is in the past. `today` is a
// YYYY-MM-DD string in Malaysia time (caller passes todayISO()).
export function prIsOverdue(r: PurchaseRequest, today: string): boolean {
  return prIsOutstanding(r) && r.needed_by != null && r.needed_by < today;
}

export type ProcurementSummary = {
  total: number;
  delivered: number;
  outstanding: number;
  overdue: number;
  avgRequestToOrderDays: number | null;
  avgOrderToDeliveryDays: number | null;
};

// Roll a project's requests into the summary header shown atop the register.
export function summarizeProcurement(
  requests: PurchaseRequest[],
  today: string,
): ProcurementSummary {
  const toOrder: number[] = [];
  const toDeliver: number[] = [];
  let delivered = 0;
  let outstanding = 0;
  let overdue = 0;

  for (const r of requests) {
    if (r.status === "delivered") delivered++;
    if (prIsOutstanding(r)) outstanding++;
    if (prIsOverdue(r, today)) overdue++;
    const o = daysBetween(r.created_at, r.ordered_at);
    if (o != null) toOrder.push(o);
    const d = daysBetween(r.ordered_at, r.delivered_at);
    if (d != null) toDeliver.push(d);
  }

  const avg = (xs: number[]): number | null =>
    xs.length === 0 ? null : Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10;

  return {
    total: requests.length,
    delivered,
    outstanding,
    overdue,
    avgRequestToOrderDays: avg(toOrder),
    avgOrderToDeliveryDays: avg(toDeliver),
  };
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

// Open request counts per project, also flagging how many are aged (48h+).
// Used for the office dashboard without signing photo URLs.
export async function getOpenRequestCountsByProject(): Promise<
  Record<string, { total: number; aged: number }>
> {
  if (!isSupabaseConfigured) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchase_requests")
    .select("project_id, status, created_at, ordered_at, delivered_at")
    .in("status", [...PR_OPEN_STATUSES, "delivered"]);
  const rows = (data ?? []) as unknown as PurchaseRequest[];
  const visible = rows.filter(isRequestVisible);
  const counts: Record<string, { total: number; aged: number }> = {};
  for (const r of visible) {
    const key = r.project_id;
    if (!counts[key]) counts[key] = { total: 0, aged: 0 };
    counts[key].total += 1;
    // Only flag as "aged" while still waiting on the office (pending/Accepted);
    // an Ordered request is no longer the office's overdue item.
    if (
      (r.status === "pending" || r.status === "approved") &&
      prAgeHours(r) >= 48
    )
      counts[key].aged += 1;
  }
  return counts;
}
