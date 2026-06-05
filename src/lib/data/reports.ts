import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isSunday } from "@/lib/date";

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

// Reports with their children over an inclusive date range — for the date-range
// PDF exports (consultant / client / boss). Ascending by date.
export async function getReportsInRange(
  projectId: string,
  from: string,
  to: string,
): Promise<ReportWithChildren[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_reports")
    .select(`${REPORT_COLUMNS}, ${REPORT_CHILDREN}`)
    .eq("project_id", projectId)
    .gte("report_date", from)
    .lte("report_date", to)
    .order("report_date", { ascending: true });
  return (data ?? []) as ReportWithChildren[];
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

// The N most recent reports WITH their children (manpower/machinery/issues/
// visitors) — for the office "view all" page that lays the latest days out in
// full. Newest first.
export async function getRecentReportsWithChildren(
  projectId: string,
  limit: number,
): Promise<ReportWithChildren[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_reports")
    .select(`${REPORT_COLUMNS}, ${REPORT_CHILDREN}`)
    .eq("project_id", projectId)
    .order("report_date", { ascending: false })
    .limit(limit);
  return (data ?? []) as ReportWithChildren[];
}

// The N most recent reports, optionally skipping Sunday-dated ones (the office
// timeline shows the recent working week — Sundays don't count as a work day).
export async function getRecentReports(
  projectId: string,
  limit: number,
  opts: { excludeSunday?: boolean } = {},
): Promise<DailyReport[]> {
  const all = await getProjectReports(projectId);
  const filtered = opts.excludeSunday
    ? all.filter((r) => !isSunday(r.report_date))
    : all;
  return filtered.slice(0, limit);
}

// Photos attached to a daily report (signed for display). Skips archived ones.
export type ReportPhoto = {
  id: string;
  storage_path: string;
  archived_at: string | null;
  url?: string | null;
};

async function signPhotos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: ReportPhoto[],
): Promise<ReportPhoto[]> {
  return Promise.all(
    rows.map(async (p) => {
      if (p.archived_at != null) return { ...p, url: null };
      const { data: signed } = await supabase.storage
        .from("site-photos")
        .createSignedUrl(p.storage_path, 3600);
      return { ...p, url: signed?.signedUrl ?? null };
    }),
  );
}

export async function getReportPhotos(reportId: string): Promise<ReportPhoto[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("photos")
    .select("id, storage_path, archived_at")
    .eq("daily_report_id", reportId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  return signPhotos(supabase, (data ?? []) as ReportPhoto[]);
}

const RECYCLE_DAYS = 3;

// Every photo the site captured on this report's day for the project — the
// report's own photos PLUS anything shot that day under Progress / Stages /
// Deliveries (which link elsewhere). Lets the office see the day's photos when
// reviewing the daily report. Matched by upload date in Malaysia time.
export async function getReportDayPhotos(
  projectId: string,
  reportDate: string,
  reportId: string,
): Promise<ReportPhoto[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const start = `${reportDate}T00:00:00+08:00`;
  const end = `${reportDate}T23:59:59.999+08:00`;
  const [byReport, byDay] = await Promise.all([
    supabase
      .from("photos")
      .select("id, storage_path, archived_at, created_at")
      .eq("daily_report_id", reportId)
      .is("deleted_at", null),
    // Progress / stage photos shot that day. Excludes deliveries (DO photos),
    // purchase-request photos and project reference photos — they have their own
    // places and shouldn't clutter the daily report.
    supabase
      .from("photos")
      .select("id, storage_path, archived_at, created_at")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .is("delivery_id", null)
      .is("purchase_request_id", null)
      .eq("is_project_ref", false)
      .gte("created_at", start)
      .lte("created_at", end),
  ]);
  const byId = new Map<string, ReportPhoto & { created_at?: string }>();
  for (const p of [...(byReport.data ?? []), ...(byDay.data ?? [])]) {
    byId.set(p.id as string, p as ReportPhoto & { created_at?: string });
  }
  const rows = [...byId.values()].sort((a, b) =>
    (a.created_at ?? "").localeCompare(b.created_at ?? ""),
  );
  return signPhotos(supabase, rows);
}

export type DeletedPhoto = ReportPhoto & { deleted_at: string };

// Photos soft-deleted in the last 3 days for a project — the recycle bin.
export async function getDeletedPhotos(projectId: string): Promise<DeletedPhoto[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - RECYCLE_DAYS * 86_400_000).toISOString();
  const { data } = await supabase
    .from("photos")
    .select("id, storage_path, archived_at, deleted_at")
    .eq("project_id", projectId)
    .not("deleted_at", "is", null)
    .gte("deleted_at", cutoff)
    .order("deleted_at", { ascending: false });
  // Sign regardless of archived flag so the bin can preview them.
  const rows = (data ?? []) as DeletedPhoto[];
  const signed = await Promise.all(
    rows.map(async (p) => {
      const { data: s } = await supabase.storage
        .from("site-photos")
        .createSignedUrl(p.storage_path, 3600);
      return { ...p, url: s?.signedUrl ?? null };
    }),
  );
  return signed;
}

// Hard-delete photos whose 3-day recovery window has passed (storage + row).
export async function purgeExpiredDeletedPhotos(projectId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - RECYCLE_DAYS * 86_400_000).toISOString();
  const { data } = await supabase
    .from("photos")
    .select("id, storage_path")
    .eq("project_id", projectId)
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff);
  const rows = (data ?? []) as { id: string; storage_path: string }[];
  if (rows.length === 0) return;
  const paths = rows.map((r) => r.storage_path).filter(Boolean);
  if (paths.length) await supabase.storage.from("site-photos").remove(paths);
  await supabase.from("photos").delete().in("id", rows.map((r) => r.id));
}

// Count of day-photos (report + progress/stage, no DO) per report date — for the
// "view all" list. One query over the span of the given dates, bucketed in MYT.
export async function getReportDayPhotoCounts(
  projectId: string,
  dates: string[],
): Promise<Record<string, number>> {
  if (!isSupabaseConfigured || dates.length === 0) return {};
  const supabase = await createClient();
  const min = dates.reduce((a, b) => (a < b ? a : b));
  const max = dates.reduce((a, b) => (a > b ? a : b));
  const { data } = await supabase
    .from("photos")
    .select("created_at")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .is("delivery_id", null)
    .is("purchase_request_id", null)
    .eq("is_project_ref", false)
    .gte("created_at", `${min}T00:00:00+08:00`)
    .lte("created_at", `${max}T23:59:59.999+08:00`);
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
  const counts: Record<string, number> = {};
  for (const p of (data ?? []) as { created_at: string }[]) {
    const d = fmt.format(new Date(p.created_at));
    counts[d] = (counts[d] ?? 0) + 1;
  }
  return counts;
}
