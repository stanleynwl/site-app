import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Purchase orders. Supabase is the source of truth shared with the local office
// app: both systems mint numbers from public.next_po_number() and write rows
// here (source = 'web' | 'local'). See docs/PURCHASE_ORDER_SYNC.md.
//
// Lifecycle: draft (office keying prices) -> issued (sent to supplier)
//            -> cancelled. Revising an issued PO bumps revision ("Rev 1").

export type PurchaseOrderStatus = "draft" | "issued" | "cancelled";

export type PurchaseOrderItem = {
  id: string;
  material_id: string | null;
  material_text: string | null;
  material: { name: string; unit: string | null } | null;
  spec: string | null;
  quantity: number;
  unit: string | null;
  unit_price: number;
  sort_order: number;
};

export type PurchaseOrder = {
  id: string;
  po_number: string;
  revision: number;
  project_id: string;
  supplier_id: string | null;
  purchase_request_id: string | null;
  status: PurchaseOrderStatus;
  needed_by: string | null;
  delivery_address: string | null;
  terms: string | null;
  note: string | null;
  tax_percent: number;
  source: string;
  issued_at: string | null;
  issued_by_name: string | null;
  created_at: string;
  supplier: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    payment_terms: string | null;
  } | null;
  items: PurchaseOrderItem[];
};

const SELECT = `
  id, po_number, revision, project_id, supplier_id, purchase_request_id, status,
  needed_by, delivery_address, terms, note, tax_percent, source, issued_at,
  issued_by_name, created_at,
  supplier:suppliers(name, address, phone, email, payment_terms),
  purchase_order_items(
    id, material_id, material_text, spec, quantity, unit, unit_price, sort_order,
    material:materials(name, unit)
  )
`;

type RawItem = Omit<PurchaseOrderItem, "material"> & {
  material: { name: string; unit: string | null } | { name: string; unit: string | null }[] | null;
};

// PostgREST returns embedded to-one relations as an object, but some client
// versions surface them as a one-element array — normalise both shapes.
function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

function mapOrder(row: unknown): PurchaseOrder {
  const { purchase_order_items, supplier, ...rest } = row as Omit<
    PurchaseOrder,
    "items" | "supplier"
  > & {
    purchase_order_items: RawItem[] | null;
    supplier: PurchaseOrder["supplier"] | PurchaseOrder["supplier"][] | null;
  };
  const items = (purchase_order_items ?? [])
    .map((it) => ({ ...it, material: one(it.material) }))
    .sort((a, b) => a.sort_order - b.sort_order);
  return { ...rest, supplier: one(supplier), items };
}

// Every PO for a project, newest first.
export async function getProjectPurchaseOrders(
  projectId: string,
): Promise<PurchaseOrder[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchase_orders")
    .select(SELECT)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapOrder);
}

export async function getPurchaseOrder(poId: string): Promise<PurchaseOrder | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchase_orders")
    .select(SELECT)
    .eq("id", poId)
    .maybeSingle();
  return data ? mapOrder(data) : null;
}

// PO ids keyed by the request they were raised from, so the request queue can
// show "already has a PO" instead of offering Create PO twice.
export async function getPoIdsByRequest(): Promise<Map<string, PurchaseOrder>> {
  const byRequest = new Map<string, PurchaseOrder>();
  if (!isSupabaseConfigured) return byRequest;
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchase_orders")
    .select(SELECT)
    .not("purchase_request_id", "is", null)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });
  for (const row of data ?? []) {
    const po = mapOrder(row);
    // Newest first, so only keep the first (latest) PO per request.
    if (po.purchase_request_id && !byRequest.has(po.purchase_request_id))
      byRequest.set(po.purchase_request_id, po);
  }
  return byRequest;
}

// Letterhead for the printed document.
export async function getCompanyForProject(projectId: string) {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("company_id")
    .eq("id", projectId)
    .maybeSingle();
  const companyId = (project as { company_id: string | null } | null)?.company_id;
  if (!companyId) return null;
  const { data } = await supabase
    .from("companies")
    .select("name, address, phone, email, registration_no")
    .eq("id", companyId)
    .maybeSingle();
  return data as {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    registration_no: string | null;
  } | null;
}

export function poItemName(item: PurchaseOrderItem): string {
  return item.material?.name ?? item.material_text ?? "—";
}

export function poLineTotal(item: PurchaseOrderItem): number {
  return item.quantity * item.unit_price;
}

export function poSubtotal(po: PurchaseOrder): number {
  return po.items.reduce((sum, it) => sum + poLineTotal(it), 0);
}

export function poTax(po: PurchaseOrder): number {
  return (poSubtotal(po) * po.tax_percent) / 100;
}

export function poTotal(po: PurchaseOrder): number {
  return poSubtotal(po) + poTax(po);
}

// "PO-4719" or "PO-4719 Rev 2" — matches how the local app labels revisions.
export function poLabel(po: PurchaseOrder): string {
  return po.revision > 0 ? `${po.po_number} Rev ${po.revision}` : po.po_number;
}
