import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { getReportById } from "@/lib/data/reports";
import { defaultTradeKey } from "@/lib/trades";
import { defaultMachineKey } from "@/lib/machines";
import { todayISO } from "@/lib/date";
import { PrintButton } from "@/components/print-button";

// Print-optimized daily report → browser "Save as PDF" (no extra deps). The
// office sidebar + the toolbar are hidden in print via globals.css @media print.
export default async function ReportPrintPage({
  params,
}: {
  params: Promise<{ id: string; reportId: string }>;
}) {
  const { id, reportId } = await params;
  const [project, report] = await Promise.all([
    getProject(id),
    getReportById(reportId),
  ]);
  if (!project || !report) notFound();

  const tr = await getTranslations("Report");
  const ts = await getTranslations("Status");
  const tp = await getTranslations("Pdf");
  const isNoWork = report.report_type === "no_work";

  const meta = [
    ts(report.status),
    report.is_backdated ? tr("backdatedBadge") : null,
    isNoWork
      ? tr("reportType.no_work")
      : report.weather
        ? tr(`weatherOpt.${report.weather}`)
        : null,
    !isNoWork && report.rain_hours != null ? `${report.rain_hours}h ${tr("rainHours")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-2xl space-y-6 text-black">
      {/* Toolbar — hidden when printing */}
      <div className="no-print flex items-center justify-between">
        <Link
          href={`/office/projects/${id}/reports/${reportId}`}
          className="text-sm text-black/50 underline dark:text-white/60"
        >
          ← {tp("backToReport")}
        </Link>
        <PrintButton />
      </div>

      <article className="space-y-5 rounded-lg border border-black/15 bg-white p-8 text-sm leading-relaxed text-black print:border-0 print:p-0">
        <header className="border-b border-black/20 pb-3">
          <h1 className="text-lg font-bold">{project.name}</h1>
          <p className="text-black/60">
            {[project.code, project.location].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-2 font-semibold">
            {tr("title")} — {report.report_date}
          </p>
          {meta && <p className="text-black/60">{meta}</p>}
        </header>

        {isNoWork ? (
          <Section title={tr("noWorkReason")}>
            {report.no_work_reason
              ? tr(`noWorkReasonOpt.${report.no_work_reason}`)
              : "—"}
          </Section>
        ) : (
          <>
            <Section title={tr("manpower")}>
              {report.manpower_entries.length === 0 ? (
                "—"
              ) : (
                <ul className="ml-4 list-disc">
                  {report.manpower_entries.map((m) => {
                    const key = defaultTradeKey(m.trade);
                    const label = key ? tr(`trades.${key}`) : m.trade;
                    return (
                      <li key={m.id}>
                        {label}
                        {m.subcontractor ? ` (${m.subcontractor})` : ""}:{" "}
                        {m.worker_count}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            <Section title={tr("machinery")}>
              {report.machinery_entries.length === 0 ? (
                "—"
              ) : (
                <ul className="ml-4 list-disc">
                  {report.machinery_entries.map((m) => {
                    const key = defaultMachineKey(m.machine_type);
                    const label = key ? tr(`machineTypes.${key}`) : m.machine_type;
                    return (
                      <li key={m.id}>
                        {label}: {m.hours_worked ?? 0}h
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            <Section title={tr("workDone")}>
              <span className="whitespace-pre-wrap">{report.work_done || "—"}</span>
            </Section>
          </>
        )}

        {report.visitor_entries.length > 0 && (
          <Section title={tr("visitors")}>
            <ul className="ml-4 list-disc">
              {report.visitor_entries.map((v) => (
                <li key={v.id}>
                  {v.name}
                  {v.purpose ? ` — ${v.purpose}` : ""}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title={tr("issues")}>
          {report.issues.length === 0 ? (
            "—"
          ) : (
            <ul className="ml-4 list-disc">
              {report.issues.map((i) => (
                <li key={i.id}>
                  {i.description} [{tr(`cat.${i.category}`)}]
                </li>
              ))}
            </ul>
          )}
        </Section>

        {report.notes && (
          <Section title={tr("notes")}>
            <span className="whitespace-pre-wrap">{report.notes}</span>
          </Section>
        )}

        <footer className="border-t border-black/20 pt-3 text-xs text-black/50">
          {tp("generated", { date: todayISO() })}
        </footer>
      </article>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-1 font-semibold">{title}</h2>
      <div className="text-black/80">{children}</div>
    </section>
  );
}
