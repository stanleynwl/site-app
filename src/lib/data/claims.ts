import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Monthly piece-rate "work-done" claims, one per subcontractor per month.

export type ClaimItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  sort_order: number;
};

export type Claim = {
  id: string;
  subcontractor_id: string;
  period_month: string;
  status: string;
  note: string | null;
  items: ClaimItem[];
};

const SELECT =
  "id, subcontractor_id, period_month, status, note, claim_items(id, description, quantity, unit, unit_price, sort_order)";

function mapClaim(row: unknown): Claim {
  const { claim_items, ...rest } = row as Omit<Claim, "items"> & {
    claim_items: ClaimItem[] | null;
  };
  const items = (claim_items ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
  return { ...rest, items };
}

// All claims (with their line items) for a project in a month.
export async function getProjectClaims(
  projectId: string,
  month: string,
): Promise<Claim[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("claims")
    .select(SELECT)
    .eq("project_id", projectId)
    .eq("period_month", `${month}-01`);
  return (data ?? []).map(mapClaim);
}

// One subcontractor's claim for a project+month (or null if not started yet).
export async function getClaim(
  projectId: string,
  subcontractorId: string,
  month: string,
): Promise<Claim | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("claims")
    .select(SELECT)
    .eq("project_id", projectId)
    .eq("subcontractor_id", subcontractorId)
    .eq("period_month", `${month}-01`)
    .maybeSingle();
  return data ? mapClaim(data) : null;
}

export function claimTotal(claim: Claim): number {
  return claim.items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);
}
