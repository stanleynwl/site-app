import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { ReportStatus, Weather } from "./reports";

export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";

export type Project = {
  id: string;
  name: string;
  code: string | null;
  location: string | null;
  start_date: string | null;
  status: ProjectStatus;
  created_by: string | null;
};

export type ProjectWithLatest = Project & {
  latest: { report_date: string; status: ReportStatus; weather: Weather | null } | null;
};

const PROJECT_COLUMNS = "id, name, code, location, start_date, status, created_by";

export async function getMyProjects(): Promise<Project[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .order("created_at", { ascending: false });
  return (data ?? []) as Project[];
}

export async function getProject(id: string): Promise<Project | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  return (data as Project) ?? null;
}

export async function getProjectsWithLatestReport(): Promise<ProjectWithLatest[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select(`${PROJECT_COLUMNS}, daily_reports(report_date, status, weather)`)
    .order("report_date", { referencedTable: "daily_reports", ascending: false })
    .limit(1, { referencedTable: "daily_reports" })
    .order("created_at", { ascending: false });

  return (data ?? []).map((p) => {
    const { daily_reports, ...project } = p as Project & {
      daily_reports: ProjectWithLatest["latest"][];
    };
    return { ...project, latest: daily_reports?.[0] ?? null };
  });
}
