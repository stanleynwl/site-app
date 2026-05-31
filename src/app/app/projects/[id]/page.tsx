import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { getReportForDate } from "@/lib/data/reports";
import {
  todayISO,
  yesterdayISO,
  daysAgoISO,
  normalizeReportDate,
  isInSoftEditWindow,
  MAX_BACKDATE_DAYS,
} from "@/lib/date";
import { DailyReportForm } from "@/components/daily-report-form";
import { ReportDateNav } from "@/components/report-date-nav";

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const { date: dateParam } = await searchParams;
  const project = await getProject(id);
  if (!project) notFound();

  const t = await getTranslations("Report");
  const today = todayISO();

  // Selected date: today by default, or a valid past date for backfilling a
  // missed day. Invalid / future / too-old dates fall back to today.
  const selectedDate = (dateParam && normalizeReportDate(dateParam)) || today;
  const isBackdated = selectedDate !== today;

  // Pre-fill from yesterday only applies to today's fresh report (the daily-use
  // friction reducer) — not when backfilling an arbitrary past date.
  const [report, yesterdayReport] = await Promise.all([
    getReportForDate(id, selectedDate),
    isBackdated ? Promise.resolve(null) : getReportForDate(id, yesterdayISO()),
  ]);

  // Pre-fill policy (explicit): manpower YES, weather NO, work_done NEVER, notes NEVER.
  // Only when there is no existing report for the day.
  const preFillManpower =
    report == null && yesterdayReport != null
      ? yesterdayReport.manpower_entries.map((m) => ({
          trade: m.trade,
          subcontractor: m.subcontractor ?? "",
          worker_count: m.worker_count,
        }))
      : null;

  // Machinery pre-fills from yesterday too (same policy as manpower / equipment).
  const preFillMachinery =
    report == null && yesterdayReport != null
      ? yesterdayReport.machinery_entries.map((m) => ({
          machine_type: m.machine_type,
          hours_worked: m.hours_worked,
        }))
      : null;

  // Author may still amend a submitted report until end of the day it was sent.
  const canSoftEdit =
    report?.status === "submitted" && isInSoftEditWindow(report.submitted_at);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">{project.name}</h1>
          <p className="text-xs text-black/50 dark:text-white/50">
            {t("title")} · {selectedDate}
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          <Link
            href={`/app/projects/${id}/deliveries`}
            className="whitespace-nowrap text-sm underline"
          >
            {t("deliveries")}
          </Link>
          <Link
            href={`/app/projects/${id}/progress`}
            className="whitespace-nowrap text-sm underline"
          >
            {t("progress")}
          </Link>
          <Link
            href={`/app/projects/${id}/stages`}
            className="whitespace-nowrap text-sm underline"
          >
            {t("stages")}
          </Link>
          <Link
            href={`/app/projects/${id}/requests`}
            className="whitespace-nowrap text-sm underline"
          >
            {t("requests")}
          </Link>
          <Link
            href={`/app/projects/${id}/stock`}
            className="whitespace-nowrap text-sm underline"
          >
            {t("stock")}
          </Link>
        </nav>
      </div>

      <ReportDateNav
        date={selectedDate}
        today={today}
        minDate={daysAgoISO(MAX_BACKDATE_DAYS)}
      />

      {isBackdated && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {t("backdatedNotice", { date: selectedDate })}
        </p>
      )}

      <DailyReportForm
        projectId={id}
        reportDate={selectedDate}
        report={report}
        preFillManpower={preFillManpower}
        preFillMachinery={preFillMachinery}
        canSoftEdit={canSoftEdit}
      />
    </div>
  );
}
