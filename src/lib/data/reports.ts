import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type Weather = "sunny" | "cloudy" | "light_rain" | "heavy_rain";
export type ReportStatus = "draft" | "submitted" | "locked";
export type IssueCategory = "material" | "weather" | "consultant" | "other";
export type ReportType = "normal" | "no_work";
export type NoWorkReason = "holiday" | "weather" | "site_closed" | "other";

export type ManpowerEntry = {
  id: string;
  trade: string;
  subcontractor: string | null;
  worker_count: number;
};

export type MachineryEntry = {
  id: string;
  machine_type: string;
  hours_worked: number | null;
};

export type VisitorEntry = {
  id: string;
  name: string;
  purpose: string | null;
};

export type Issue = {
  id: string;
  description: string;
  category: IssueCategory;
  resolved: boolean;
};

export type DailyReport = {
  id: string;
  project_id: string;
  report_date: string;
  author_id: string | null;
  status: ReportStatus;
  report_type: ReportType;
  no_work_reason: NoWorkReason | null;
  weather: Weather | null;
  rain_hours: number | null;
  work_done: string | null;
  notes: string | null;
  submitted_at: string | null;
  is_backdated: boolean;
};

export type ReportWithChildren = DailyReport & {
  manpower_entries: ManpowerEntry[];
  machinery_entries: MachineryEntry[];
  visitor_entries: VisitorEntry[];
  issues: Issue[];
};

const REPORT_COLUMNS =
  "id, project_id, report_date, author_id, status, report_type, no_work_reason, weather, rain_hours, work_done, notes, submitted_at, is_backdated";

const REPORT_CHILDREN =
  "manpower_entries(id, trade, subcontractor, worker_count), machinery_entries(id, machine_type, hours_worked), visitor_entries(id, name, purpose), issues(id, description, category, resolved)";

export async function getReportForDate(
  projectId: string,
  date: string,
): Promise<ReportWithChildren | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_reports")
    .select(`${REPORT_COLUMNS}, ${REPORT_CHILDREN}`)
    .eq("project_id", projectId)
    .eq("report_date", date)
    .maybeSingle();
  return (data as ReportWithChildren) ?? null;
}

export async function getReportById(
  id: string,
): Promise<ReportWithChildren | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_reports")
    .select(`${REPORT_COLUMNS}, ${REPORT_CHILDREN}`)
    .eq("id", id)
    .maybeSingle();
  return (data as ReportWithChildren) ?? null;
}

export async function getProjectReports(
  projectId: string,
): Promise<DailyReport[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_reports")
    .select(REPORT_COLUMNS)
    .eq("project_id", projectId)
    .order("report_date", { ascending: false });
  return (data ?? []) as DailyReport[];
}
