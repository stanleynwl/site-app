import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Managed reference data (Phase 2). Suppliers + materials are company-wide;
// any authenticated user may read, only pm/office may write (enforced by RLS).

export type Supplier = {
  id: string;
  name: string;
  code: string | null;
  phone: string | null;
  active: boolean;
};

export type Material = {
  id: string;
  name: string;
  unit: string | null;
  count_required: boolean;
  active: boolean;
};

export async function getSuppliers(): Promise<Supplier[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("suppliers")
    .select("id, name, code, phone, active")
    .order("active", { ascending: false })
    .order("name");
  return (data ?? []) as Supplier[];
}

export async function getMaterials(): Promise<Material[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("materials")
    .select("id, name, unit, count_required, active")
    .order("active", { ascending: false })
    .order("name");
  return (data ?? []) as Material[];
}
