import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getReportById, getReportDayPhotos } from "@/lib/data/reports";
import {
  unlockReport,
  deleteReportPhoto,
  assignIssue,
  setIssueResolved,
  type UnlockReportState,
} from "@/lib/data/actions";
import { getProfile, listProfiles } from "@/lib/auth/dal";
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
  const [report, profile, profiles] = await Promise.all([
    getReportById(reportId),
    getProfile(),
    listProfiles(),
  ]);
  if (!report) notFound();
  // All photos shot on this report's day (report + progress/stages/deliveries).
  const photos = await getReportDayPhotos(id, report.report_date, reportId);

  const t = await getTranslations("Office");
  const tr = await getTranslations("Report");
  const ts = await getTranslations("Status");
  const tp = await getTranslations("Pdf");
  const ti = await getTranslations("Issues");

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
          <ul className="space-y-2 text-sm">
            {report.issues.map((i) => {
              const closed = i.closed_at != null;
              return (
                <li
                  key={i.id}
                  className="space-y-2 rounded-lg border border-black/10 p-2.5 dark:border-white/15"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className={closed ? "text-black/50 line-through dark:text-white/50" : ""}>
                      {i.description}{" "}
                      <span className="text-black/50 no-underline dark:text-white/50">
                        [{tr(`cat.${i.category}`)}]
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        closed
                          ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                      }`}
                    >
                      {closed ? ti("closed") : ti("open")}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={assignIssue} className="flex items-center gap-1">
                      <input type="hidden" name="issue_id" value={i.id} />
                      <input type="hidden" name="project_id" value={id} />
                      <input type="hidden" name="report_id" value={reportId} />
                      <select
                        name="assigned_to"
                        defaultValue={i.assigned_to ?? ""}
                        className="rounded-lg border border-black/20 bg-transparent px-2 py-1 text-xs outline-none focus:border-black/40 dark:border-white/25 dark:focus:border-white/50"
                      >
                        <option value="">{ti("unassigned")}</option>
                        {profiles.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.username}
                          </option>
                        ))}
                      </select>
                      <button className="rounded-lg border border-black/20 px-2 py-1 text-xs font-medium dark:border-white/25">
                        {ti("assign")}
                      </button>
                    </form>
                    <form action={setIssueResolved}>
                      <input type="hidden" name="issue_id" value={i.id} />
                      <input type="hidden" name="project_id" value={id} />
                      <input type="hidden" name="report_id" value={reportId} />
                      <input type="hidden" name="resolved" value={closed ? "0" : "1"} />
                      <button
                        className={`rounded-lg border border-black/20 px-2 py-1 text-xs font-medium dark:border-white/25 ${
                          closed ? "" : "text-green-700 dark:text-green-400"
                        }`}
                      >
                        {closed ? ti("reopen") : ti("close")}
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
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

      {photos.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold">{tr("photos")}</h2>
          <div className="flex flex-wrap gap-2">
            {photos.map((p) =>
              p.url ? (
                <div key={p.id} className="relative">
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt=""
                      className="h-24 w-24 rounded-lg object-cover"
                    />
                  </a>
                  {profile?.can_office && (
                    <form
                      action={deleteReportPhoto}
                      className="absolute -right-2 -top-2"
                    >
                      <input type="hidden" name="photo_id" value={p.id} />
                      <input type="hidden" name="project_id" value={id} />
                      <input type="hidden" name="report_id" value={reportId} />
                      <button
                        aria-label={tr("remove")}
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white"
                      >
                        ✕
                      </button>
                    </form>
                  )}
                </div>
              ) : null,
            )}
          </div>
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
