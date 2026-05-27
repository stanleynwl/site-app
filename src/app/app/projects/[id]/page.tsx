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
  softEditMinutesLeft,
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

  const minutesLeft =
    report?.status === "submitted" ? softEditMinutesLeft(report.submitted_at) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold">{project.name}</h1>
          <p className="text-xs text-black/50 dark:text-white/50">
            {t("title")} · {selectedDate}
          </p>
        </div>
        <div className="flex gap-4">
          <Link
            href={`/app/projects/${id}/deliveries`}
            className="text-sm underline"
          >
            {t("deliveries")}
          </Link>
          <Link href={`/app/projects/${id}/photos`} className="text-sm underline">
            {t("photos")}
          </Link>
        </div>
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
        softEditMinutesLeft={minutesLeft}
      />
    </div>
  );
}
