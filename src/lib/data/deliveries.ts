import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Phase 2 — three-quantity delivery model. Material flow captured at three
// points by three parties: requested (purchase request, Phase 4), do_quantity
// (office from DO photo), received_quantity (supervisor at delivery, only when
// the material is flagged count_required). Variance is derived, not stored.

export type Delivery = {
  id: string;
  project_id: string;
  do_number: string | null;
  delivered_on: string | null;
  unit: string | null;
  requested_quantity: number | null;
  do_quantity: number | null;
  received_quantity: number | null;
  material_text: string | null;
  supplier: { name: string } | null;
  material: { name: string; count_required: boolean } | null;
};

const DELIVERY_COLUMNS =
  "id, project_id, do_number, delivered_on, unit, requested_quantity, do_quantity, received_quantity, material_text, supplier:suppliers(name), material:materials(name, count_required)";

export async function getProjectDeliveries(
  projectId: string,
): Promise<Delivery[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("deliveries")
    .select(DELIVERY_COLUMNS)
    .eq("project_id", projectId)
    .order("delivered_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as Delivery[];
}

// Display name for a delivery's material: catalog name, else free-text, else —.
export function deliveryMaterialName(d: Delivery): string {
  return d.material?.name ?? d.material_text ?? "—";
}

// Variance between what arrived (received) and what the DO claims (do_quantity).
// Returns null when either side is missing.
export function deliveryVariance(d: Delivery): number | null {
  if (d.received_quantity == null || d.do_quantity == null) return null;
  return Number((d.received_quantity - d.do_quantity).toFixed(3));
}
