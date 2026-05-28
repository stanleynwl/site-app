import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Phase 5 (operations) — weekly stock-on-site counts. We store the physical
// counts; consumption is DERIVED between consecutive counts:
//   consumption = previous_qty + deliveries_in_between − current_qty
// Deliveries contribute received_quantity (else do_quantity). Only catalog
// materials (material_id) participate; free-text deliveries can't be matched.

export type StockCount = {
  id: string;
  count_date: string;
  quantity: number;
  unit: string | null;
  note: string | null;
  material: { name: string; unit: string | null } | null;
};

export type StockSummary = {
  material_id: string;
  material_name: string;
  unit: string | null;
  latest_date: string;
  latest_qty: number;
  previous_date: string | null;
  delivered_between: number | null;
  consumption: number | null;
};

const STOCK_COLUMNS =
  "id, count_date, quantity, unit, note, material:materials(name, unit)";

export async function getProjectStockCounts(
  projectId: string,
): Promise<StockCount[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("stock_counts")
    .select(STOCK_COLUMNS)
    .eq("project_id", projectId)
    .order("count_date", { ascending: false });
  return (data ?? []) as unknown as StockCount[];
}

type CountRow = {
  material_id: string;
  count_date: string;
  quantity: number;
  unit: string | null;
  material: { name: string; unit: string | null } | null;
};
type DeliveryRow = {
  material_id: string | null;
  delivered_on: string | null;
  do_quantity: number | null;
  received_quantity: number | null;
};

// Per-material latest count + consumption derived since the previous count.
export async function getStockSummary(
  projectId: string,
): Promise<StockSummary[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();

  const [{ data: counts }, { data: deliveries }] = await Promise.all([
    supabase
      .from("stock_counts")
      .select("material_id, count_date, quantity, unit, material:materials(name, unit)")
      .eq("project_id", projectId)
      .order("count_date", { ascending: true }),
    supabase
      .from("deliveries")
      .select("material_id, delivered_on, do_quantity, received_quantity")
      .eq("project_id", projectId),
  ]);

  const countRows = (counts ?? []) as unknown as CountRow[];
  const deliveryRows = (deliveries ?? []) as unknown as DeliveryRow[];

  // Group counts by material (already date-ascending).
  const byMaterial = new Map<string, CountRow[]>();
  for (const c of countRows) {
    if (!c.material_id) continue;
    const list = byMaterial.get(c.material_id) ?? [];
    list.push(c);
    byMaterial.set(c.material_id, list);
  }

  const summaries: StockSummary[] = [];
  for (const [materialId, list] of byMaterial) {
    const latest = list[list.length - 1];
    const previous = list.length >= 2 ? list[list.length - 2] : null;

    let delivered: number | null = null;
    let consumption: number | null = null;
    if (previous) {
      // Sum deliveries of this material that landed in (previous, latest].
      delivered = deliveryRows
        .filter(
          (d) =>
            d.material_id === materialId &&
            d.delivered_on != null &&
            d.delivered_on > previous.count_date &&
            d.delivered_on <= latest.count_date,
        )
        .reduce(
          (sum, d) => sum + (d.received_quantity ?? d.do_quantity ?? 0),
          0,
        );
      consumption = Number(
        (previous.quantity + delivered - latest.quantity).toFixed(3),
      );
    }

    summaries.push({
      material_id: materialId,
      material_name: latest.material?.name ?? "—",
      unit: latest.unit ?? latest.material?.unit ?? null,
      latest_date: latest.count_date,
      latest_qty: latest.quantity,
      previous_date: previous?.count_date ?? null,
      delivered_between: delivered,
      consumption,
    });
  }

  // Most recently counted material first.
  summaries.sort((a, b) => (a.latest_date < b.latest_date ? 1 : -1));
  return summaries;
}
