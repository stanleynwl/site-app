import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Phase 5 (operations) — machinery. Machines are company-scoped reference data;
// machine_logs capture one machine on one project on one day.

export type Machine = {
  id: string;
  name: string;
  code: string | null;
  kind: string | null;
  active: boolean;
};

export type MachineLog = {
  id: string;
  log_date: string;
  present: boolean;
  hours_worked: number | null;
  breakdown: boolean;
  breakdown_note: string | null;
  operator: string | null;
  fuel_litres: number | null;
  fuel_note: string | null;
  machine: { name: string; code: string | null } | null;
};

export async function getMachines(): Promise<Machine[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("machines")
    .select("id, name, code, kind, active")
    .order("active", { ascending: false })
    .order("name");
  return (data ?? []) as Machine[];
}

const MACHINE_LOG_COLUMNS =
  "id, log_date, present, hours_worked, breakdown, breakdown_note, operator, fuel_litres, fuel_note, machine:machines(name, code)";

export async function getProjectMachineLogs(
  projectId: string,
): Promise<MachineLog[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("machine_logs")
    .select(MACHINE_LOG_COLUMNS)
    .eq("project_id", projectId)
    .order("log_date", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as MachineLog[];
}

export function machineLabel(m: Machine): string {
  return m.code ? `${m.name} (${m.code})` : m.name;
}
