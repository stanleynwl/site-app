import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import {
  getProjectReports,
  getRecentReportsWithChildren,
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
        return `${label}${m.subcontractor ? ` (${m.subcontractor})` : ""}: ${m.worker_count}`;
      });
    const machinery = r.machinery_entries.map((m) => {
      const key = defaultMachineKey(m.machine_type);
      const label = key ? tr(`machineTypes.${key}`) : m.machine_type;
      return `${label}: ${m.hours_worked ?? 0}h`;
    });

    return (
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">{r.report_date}</span>
            <span className="badge badge-muted">{ts(r.status)}</span>
            {r.is_backdated && <span className="badge badge-warn">{tr("backdatedBadge")}</span>}
          </div>
          <Link href={`/office/projects/${id}/reports/${r.id}`} className="text-xs text-accent hover:underline">
            {t("view")} →
          </Link>
        </div>

        <dl className="mt-3 space-y-2 text-sm">
          {isNoWork ? (
            <Field label={tr("noWorkReason")}>
              {r.no_work_reason ? tr(`noWorkReasonOpt.${r.no_work_reason}`) : "—"}
            </Field>
          ) : (
            <>
              <Field label={tr("weather")}>
                {r.weather ? tr(`weatherOpt.${r.weather}`) : "—"}
                {r.rain_hours != null ? ` · ${r.rain_hours}h` : ""}
              </Field>
              <Field label={tr("manpower")}>{manpower.length ? manpower.join(", ") : "—"}</Field>
              <Field label={tr("machinery")}>{machinery.length ? machinery.join(", ") : "—"}</Field>
              <Field label={tr("workDone")} full>
                <span className="whitespace-pre-wrap">{r.work_done || "—"}</span>
              </Field>
            </>
          )}
          {r.issues.length > 0 && (
            <Field label={tr("issues")} full>
              {r.issues.map((i) => `${i.description} [${tr(`cat.${i.category}`)}]`).join("; ")}
            </Field>
          )}
          {r.visitor_entries.length > 0 && (
            <Field label={tr("visitors")} full>
              {r.visitor_entries.map((v) => (v.purpose ? `${v.name} (${v.purpose})` : v.name)).join(", ")}
            </Field>
          )}
        </dl>
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted sm:w-36 sm:shrink-0 sm:pt-0.5">
        {label}
      </dt>
      <dd className="flex-1 text-foreground">{children}</dd>
    </div>
  );
}
