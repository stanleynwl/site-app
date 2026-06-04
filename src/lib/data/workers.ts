import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Worker roster + subcontractors (company-wide managed lists, like suppliers).
// subcontractor_id NULL on a worker = own / in-house worker.

export type Subcontractor = {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
};

export type Worker = {
  id: string;
  name: string;
  subcontractor_id: string | null;
  daily_rate: number | null;
  active: boolean;
};

export async function getSubcontractors(): Promise<Subcontractor[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("subcontractors")
    .select("id, name, phone, active")
    .order("active", { ascending: false })
    .order("name");
  return (data ?? []) as Subcontractor[];
}

export async function getWorkers(): Promise<Worker[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("workers")
    .select("id, name, subcontractor_id, daily_rate, active")
    .order("active", { ascending: false })
    .order("name");
  return (data ?? []) as Worker[];
}
