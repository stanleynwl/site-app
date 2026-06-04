import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Named-worker attendance (the digital card) + advances ledger.

export type AttendanceEntry = {
  id: string;
  worker_id: string | null;
  worker_name: string | null;
  work_date: string;
  units: number;
  note: string | null;
};

export type Advance = {
  id: string;
  worker_id: string | null;
  subcontractor_id: string | null;
  advance_date: string;
  amount: number;
  note: string | null;
};

// Month helpers (month = "YYYY-MM"). ----------------------------------------
export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); // day 0 of next month
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// Current month "YYYY-MM" in Malaysia time (default for office views).
export function currentMonthMYT(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .slice(0, 7);
}

export async function getAttendanceForDate(
  projectId: string,
  date: string,
): Promise<AttendanceEntry[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_entries")
    .select("id, worker_id, worker_name, work_date, units, note")
    .eq("project_id", projectId)
    .eq("work_date", date);
  return (data ?? []) as AttendanceEntry[];
}

// All attendance rows for a month → the office worker×day grid.
export async function getMonthAttendance(
  projectId: string,
  month: string,
): Promise<AttendanceEntry[]> {
  if (!isSupabaseConfigured) return [];
  const { start, end } = monthRange(month);
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_entries")
    .select("id, worker_id, worker_name, work_date, units, note")
    .eq("project_id", projectId)
    .gte("work_date", start)
    .lte("work_date", end)
    .order("work_date");
  return (data ?? []) as AttendanceEntry[];
}

// Advances (worker- or subcontractor-level) dated within a month.
export async function getAdvances(
  projectId: string,
  month: string,
): Promise<Advance[]> {
  if (!isSupabaseConfigured) return [];
  const { start, end } = monthRange(month);
  const supabase = await createClient();
  const { data } = await supabase
    .from("advances")
    .select("id, worker_id, subcontractor_id, advance_date, amount, note")
    .eq("project_id", projectId)
    .gte("advance_date", start)
    .lte("advance_date", end)
    .order("advance_date");
  return (data ?? []) as Advance[];
}
