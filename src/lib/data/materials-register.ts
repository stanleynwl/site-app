import "server-only";
import { APP_TIMEZONE, todayISO } from "@/lib/date";
import {
  getProjectPurchaseRequests,
  summarizeProcurement,
  prIsOverdue,
  itemName,
  type PurchaseRequest,
  type ProcurementSummary,
} from "./purchase-requests";

// The Materials Procurement Register — the office's permanent, dated archive of
// every purchase request and its request→order→delivery timeline. Pure read
// layer over existing columns (created_at / ordered_at / delivered_at); no new
// schema. Filtering lives here so the on-screen page and the printable page stay
// in sync.

// MYT date / date-time / month formatters (so "all dated" is in site time).
export const mytDate = (iso: string | null): string =>
  iso
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: APP_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(iso))
    : "—";

export const mytDateTime = (iso: string | null): string =>
  iso
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: APP_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
        .format(new Date(iso))
        .replace(",", "")
    : "—";

export const mytMonth = (iso: string): string => mytDate(iso).slice(0, 7);

export type ProcurementFilters = {
  month?: string;
  status?: string; // a PurchaseRequestStatus, or the synthetic "overdue"
  supplier?: string;
  q?: string;
};

export type ProcurementView = {
  filtered: PurchaseRequest[];
  summary: ProcurementSummary; // of the FILTERED set
  months: string[]; // distinct YYYY-MM present, newest first
  suppliers: string[]; // distinct supplier names present
};

export async function getProcurementView(
  projectId: string,
  filters: ProcurementFilters,
): Promise<ProcurementView> {
  const today = todayISO();
  const all = await getProjectPurchaseRequests(projectId);

  const months = [...new Set(all.map((r) => mytMonth(r.created_at)))].sort().reverse();
  const suppliers = [
    ...new Set(all.map((r) => r.supplier?.name).filter((n): n is string => !!n)),
  ].sort();

  const q = (filters.q ?? "").toLowerCase();
  const filtered = all.filter((r) => {
    if (filters.month && mytMonth(r.created_at) !== filters.month) return false;
    if (filters.status === "overdue") {
      if (!prIsOverdue(r, today)) return false;
    } else if (filters.status && r.status !== filters.status) return false;
    if (filters.supplier && r.supplier?.name !== filters.supplier) return false;
    if (q) {
      const hay = [
        ...r.items.map((i) => itemName(i)),
        ...r.items.map((i) => i.spec ?? ""),
        r.po_number ?? "",
        r.supplier?.name ?? "",
        r.note ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return { filtered, summary: summarizeProcurement(filtered, today), months, suppliers };
}
