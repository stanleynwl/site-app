import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getReportById } from "@/lib/data/reports";
import { unlockReport, type UnlockReportState } from "@/lib/data/actions";
import { getProfile } from "@/lib/auth/dal";
import { isInSoftEditWindow } from "@/lib/date";
import { defaultTradeKey } from "@/lib/trades";
import { defaultMachineKey } from "@/lib/machines";
import { UnlockForm } from "@/components/unlock-form";

export default async function OfficeReportView({
  params,
}: {
  params: Promise<{ id: string; reportId: string }>;
}) {
  const { id, reportId } = await params;
  const [report, profile] = await Promise.all([getReportById(reportId), getProfile()]);
  if (!report) notFound();

  const t = await getTranslations("Office");
  const tr = await getTranslations("Report");
  const ts = await getTranslations("Status");
  const tp = await getTranslations("Pdf");

  const isPm = profile?.role === "pm";
  const isExpiredSubmit =
    report.status === "submitted" && !isInSoftEditWindow(report.submitted_at);
  const canUnlock = isPm && (report.status === "locked" || isExpiredSubmit);
  const isNoWork = report.report_type === "no_work";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href={`/office/projects/${id}`}
          className="text-xs text-black/50 hover:underline dark:text-white/50"
        >
          ← {t("timeline")}
        </Link>
        <div className="mt-1 flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold">
            {t("reportOn", { date: report.report_date })}
          </h1>
          <Link
            href={`/office/projects/${id}/reports/${reportId}/print`}
            className="shrink-0 rounded-lg border border-black/20 px-3 py-1 text-xs font-medium dark:border-white/25"
          >
            {tp("exportPdf")}
          </Link>
        </div>
        <p className="text-sm text-black/50 dark:text-white/50">
          {ts(report.status)}
          {report.is_backdated ? ` · ${tr("backdatedBadge")}` : ""}
          {isNoWork
            ? ` · ${tr("reportType.no_work")}`
            : report.weather
              ? ` · ${tr(`weatherOpt.${report.weather}`)}${report.rain_hours != null ? ` · ${report.rain_hours}h` : ""}`
              : ""}
        </p>
      </div>

      {isNoWork ? (
        <section>
          <h2 className="mb-1 text-sm font-semibold">{tr("noWorkReason")}</h2>
          <p className="text-sm text-black/70 dark:text-white/70">
            {report.no_work_reason
              ? tr(`noWorkReasonOpt.${report.no_work_reason}`)
              : "—"}
          </p>
        </section>
      ) : (
        <>
          <section>
            <h2 className="mb-1 text-sm font-semibold">{tr("manpower")}</h2>
            {report.manpower_entries.length === 0 ? (
              <p className="text-sm text-black/50 dark:text-white/50">
                {t("noManpower")}
              </p>
            ) : (
              <ul className="text-sm">
                {report.manpower_entries.map((m) => {
                  const key = defaultTradeKey(m.trade);
                  const label = key ? tr(`trades.${key}`) : m.trade;
                  return (
                    <li key={m.id}>
                      {label}
                      {m.subcontractor ? ` (${m.subcontractor})` : ""}: {m.worker_count}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-1 text-sm font-semibold">{tr("machinery")}</h2>
            {report.machinery_entries.length === 0 ? (
              <p className="text-sm text-black/50 dark:text-white/50">—</p>
            ) : (
              <ul className="text-sm">
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
          </section>

          <section>
            <h2 className="mb-1 text-sm font-semibold">{tr("workDone")}</h2>
            <p className="whitespace-pre-wrap text-sm text-black/70 dark:text-white/70">
              {report.work_done || "—"}
            </p>
          </section>
        </>
      )}

      <section>
        <h2 className="mb-1 text-sm font-semibold">{tr("issues")}</h2>
        {report.issues.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            {t("noIssues")}
          </p>
        ) : (
          <ul className="text-sm">
            {report.issues.map((i) => (
              <li key={i.id}>
                {i.description}{" "}
                <span className="text-black/50 dark:text-white/50">
                  [{tr(`cat.${i.category}`)}]
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {report.visitor_entries.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold">{tr("visitors")}</h2>
          <ul className="text-sm">
            {report.visitor_entries.map((v) => (
              <li key={v.id}>
                {v.name}
                {v.purpose ? (
                  <span className="text-black/50 dark:text-white/50">
                    {" "}
                    — {v.purpose}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.notes && (
        <section>
          <h2 className="mb-1 text-sm font-semibold">{tr("notes")}</h2>
          <p className="whitespace-pre-wrap text-sm text-black/70 dark:text-white/70">
            {report.notes}
          </p>
        </section>
      )}

      {canUnlock && (
        <section className="border-t border-black/10 pt-4 dark:border-white/10">
          <h2 className="mb-2 text-sm font-semibold">{t("unlockReport")}</h2>
          <UnlockForm reportId={reportId} />
        </section>
      )}
    </div>
  );
}
