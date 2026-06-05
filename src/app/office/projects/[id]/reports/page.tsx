import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import {
  getProjectReports,
  getRecentReportsWithChildren,
  getReportDayPhotoCounts,
  type ReportWithChildren,
} from "@/lib/data/reports";
import { defaultTradeKey } from "@/lib/trades";
import { defaultMachineKey } from "@/lib/machines";
import { todayISO, daysAgoISO } from "@/lib/date";

const LATEST_COUNT = 5;

// Full report timeline. The latest 5 days are laid out in full (read without
// clicking in); older reports collapse into a compact list. Plus print actions.
export default async function ProjectReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, latest, allReports] = await Promise.all([
    getProject(id),
    getRecentReportsWithChildren(id, LATEST_COUNT),
    getProjectReports(id),
  ]);
  if (!project) notFound();

  const t = await getTranslations("Office");
  const ts = await getTranslations("Status");
  const tr = await getTranslations("Report");
  const tpdf = await getTranslations("Pdf");

  const older = allReports.slice(LATEST_COUNT);
  // Photo count per report day (shown on screen only — never in the PDF export).
  const photoCounts = await getReportDayPhotoCounts(
    id,
    latest.map((r) => r.report_date),
  );

  const weeklyFrom = daysAgoISO(6);
  const weeklyTo = todayISO();
  const weeklyHref = `/office/export/print?project=${id}&audience=client&from=${weeklyFrom}&to=${weeklyTo}`;

  // Compact readable card for one report.
  function ReportCard({ r }: { r: ReportWithChildren }) {
    const isNoWork = r.report_type === "no_work";
    const manpower = r.manpower_entries
      .filter((m) => m.worker_count > 0)
      .map((m) => {
        const key = defaultTradeKey(m.trade);
        const label = key ? tr(`trades.${key}`) : m.trade;
        return {
          label: `${label}${m.subcontractor ? ` (${m.subcontractor})` : ""}`,
          value: String(m.worker_count),
        };
      });
    const machinery = r.machinery_entries.map((m) => {
      const key = defaultMachineKey(m.machine_type);
      const label = key ? tr(`machineTypes.${key}`) : m.machine_type;
      return { label, value: `${m.hours_worked ?? 0}h` };
    });

    return (
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">{r.report_date}</span>
            <span className="badge badge-muted">{ts(r.status)}</span>
            {r.is_backdated && <span className="badge badge-warn">{tr("backdatedBadge")}</span>}
            {photoCounts[r.report_date] ? (
              <span className="badge badge-accent inline-flex items-center gap-1">
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
                {photoCounts[r.report_date]}
              </span>
            ) : null}
          </div>
          <Link href={`/office/projects/${id}/reports/${r.id}`} className="text-xs text-accent hover:underline">
            {t("view")} →
          </Link>
        </div>

        {isNoWork ? (
          <div className="mt-3 text-sm">
            <Section label={tr("noWorkReason")}>
              {r.no_work_reason ? tr(`noWorkReasonOpt.${r.no_work_reason}`) : "—"}
            </Section>
          </div>
        ) : (
          <div className="mt-3 grid gap-x-8 gap-y-4 text-sm md:grid-cols-3">
            {/* Left: weather + work done */}
            <div className="space-y-4">
              <Section label={tr("weather")}>
                {r.weather ? tr(`weatherOpt.${r.weather}`) : "—"}
                {r.rain_hours != null ? ` · ${r.rain_hours}h` : ""}
              </Section>
              <Section label={tr("workDone")}>
                <span className="whitespace-pre-wrap">{r.work_done || "—"}</span>
              </Section>
            </div>
            {/* Middle: manpower (one per line, numbers aligned) */}
            <Section label={tr("manpower")}>
              <KeyVals rows={manpower} />
            </Section>
            {/* Right: machinery (one per line, numbers aligned) */}
            <Section label={tr("machinery")}>
              <KeyVals rows={machinery} />
            </Section>
          </div>
        )}

        {(r.issues.length > 0 || r.visitor_entries.length > 0) && (
          <div className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
            {r.issues.length > 0 && (
              <Section label={tr("issues")}>
                {r.issues.map((i) => `${i.description} [${tr(`cat.${i.category}`)}]`).join("; ")}
              </Section>
            )}
            {r.visitor_entries.length > 0 && (
              <Section label={tr("visitors")}>
                {r.visitor_entries.map((v) => (v.purpose ? `${v.name} (${v.purpose})` : v.name)).join(", ")}
              </Section>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/office/projects/${id}`}
          className="text-xs text-muted hover:underline"
        >
          ← {project.name}
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">{t("timeline")}</h1>
          <div className="flex flex-wrap gap-2">
            <Link href={weeklyHref} className="btn">
              {tpdf("printWeekly")}
            </Link>
            <Link href={`/office/export?project=${id}`} className="btn">
              {tpdf("customRange")}
            </Link>
          </div>
        </div>
      </div>

      {latest.length === 0 ? (
        <p className="text-sm text-muted">{t("noReports")}</p>
      ) : (
        <div className="space-y-3">
          {latest.map((r) => (
            <ReportCard key={r.id} r={r} />
          ))}
        </div>
      )}

      {older.length > 0 && (
        <details className="group">
          <summary className="btn inline-flex cursor-pointer select-none items-center gap-1">
            {t("olderReports")} ({older.length})
            <span className="text-muted transition-transform group-open:rotate-90">›</span>
          </summary>
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
            {older.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-3">
                <div className="text-sm">
                  <span className="font-medium">{r.report_date}</span>
                  <span className="ml-2 text-muted">
                    {ts(r.status)}
                    {r.is_backdated ? ` · ${tr("backdatedBadge")}` : ""}
                    {r.weather ? ` · ${tr(`weatherOpt.${r.weather}`)}` : ""}
                  </span>
                </div>
                <Link
                  href={`/office/projects/${id}/reports/${r.id}`}
                  className="text-sm underline"
                >
                  {t("view")}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <div className="text-foreground">{children}</div>
    </div>
  );
}

// Vertical key/value list with the label column sized to the widest label so the
// colons line up, and the values right-aligned so the numbers line up.
function KeyVals({ rows }: { rows: { label: string; value: string }[] }) {
  if (rows.length === 0) return <span className="text-muted">—</span>;
  return (
    <dl className="inline-grid grid-cols-[max-content_auto_auto] items-baseline gap-x-2 gap-y-0.5">
      {rows.map((r, i) => (
        <Fragment key={i}>
          <dt>{r.label}</dt>
          <span className="text-muted">:</span>
          <dd className="text-right font-medium tabular-nums">{r.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
