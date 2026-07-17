import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Monthly piece-rate "work-done" claims, one per subcontractor per month.
// Lifecycle: draft (office keys lines) -> submitted (sent to site) ->
// verified (site supervisor) -> approved (PM). verified_by_name /
// approved_by_name are stamped by the verify_claim/approve_claim RPCs —
// display them directly (profiles RLS blocks a full_name join for most users).

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
  project_id: string;
  subcontractor_id: string;
  period_month: string;
  status: string;
  note: string | null;
  submitted_at: string | null;
  verified_at: string | null;
  verified_by_name: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
  items: ClaimItem[];
};

export type ClaimPhoto = {
  id: string;
  claim_id: string;
  storage_path: string;
  url?: string;
};

const SELECT =
  "id, project_id, subcontractor_id, period_month, status, note, submitted_at, verified_at, verified_by_name, approved_at, approved_by_name, claim_items(id, description, quantity, unit, unit_price, sort_order)";

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

// Every claim across projects, newest month first — the office overview page.
export async function getAllClaims(): Promise<Claim[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("claims")
    .select(SELECT)
    .order("period_month", { ascending: false })
    .limit(300);
  return (data ?? []).map(mapClaim);
}

// Claims the site should see: sent to site or beyond, newest month first.
export async function getSiteClaims(projectId: string): Promise<Claim[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("claims")
    .select(SELECT)
    .eq("project_id", projectId)
    .in("status", ["submitted", "verified", "approved"])
    .order("period_month", { ascending: false });
  return (data ?? []).map(mapClaim);
}

// Photos of the paper claims, with 1-hour signed URLs for display.
export async function getClaimPhotos(
  claimIds: string[],
): Promise<Map<string, ClaimPhoto[]>> {
  const byClaim = new Map<string, ClaimPhoto[]>();
  if (!isSupabaseConfigured || claimIds.length === 0) return byClaim;
  const supabase = await createClient();
  const { data } = await supabase
    .from("claim_photos")
    .select("id, claim_id, storage_path")
    .in("claim_id", claimIds)
    .order("created_at", { ascending: true });
  for (const p of (data ?? []) as ClaimPhoto[]) {
    const { data: signed } = await supabase.storage
      .from("site-photos")
      .createSignedUrl(p.storage_path, 3600);
    const list = byClaim.get(p.claim_id) ?? [];
    list.push({ ...p, url: signed?.signedUrl });
    byClaim.set(p.claim_id, list);
  }
  return byClaim;
}

export function claimTotal(claim: Claim): number {
  return claim.items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);
}
