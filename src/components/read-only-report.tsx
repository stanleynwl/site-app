"use client";

import { useTranslations } from "next-intl";
import { defaultTradeKey } from "@/lib/trades";
import { defaultMachineKey } from "@/lib/machines";
import type { ReportWithChildren } from "@/lib/data/reports";

// A submitted day, laid out for reading. Shown in place of the form once a
// report is locked, and on the site's past-reports page.
export function ReadOnlyReport({ report }: { report: ReportWithChildren }) {
  const t = useTranslations("Report");
  const isNoWork = report.report_type === "no_work";

  return (
    <dl className="space-y-3 text-sm">
      {isNoWork ? (
        <div>
          <dt className="font-medium">{t("noWorkReason")}</dt>
          <dd className="text-black/70 dark:text-white/70">
            {report.no_work_reason
              ? t(`noWorkReasonOpt.${report.no_work_reason}`)
              : "—"}
          </dd>
        </div>
      ) : (
        <>
          <div>
            <dt className="font-medium">{t("weather")}</dt>
            <dd className="text-black/70 dark:text-white/70">
              {report.weather ? t(`weatherOpt.${report.weather}`) : "—"}
              {report.rain_hours != null ? ` · ${report.rain_hours}h` : ""}
            </dd>
          </div>
          <div>
            <dt className="font-medium">{t("manpower")}</dt>
            <dd className="text-black/70 dark:text-white/70">
              {report.manpower_entries.length === 0
                ? "—"
                : report.manpower_entries
                    .map((m) => {
                      const key = defaultTradeKey(m.trade);
                      const label = key ? t(`trades.${key}`) : m.trade;
                      return `${label}${m.subcontractor ? ` (${m.subcontractor})` : ""}: ${m.worker_count}`;
                    })
                    .join(", ")}
            </dd>
          </div>
          <div>
            <dt className="font-medium">{t("machinery")}</dt>
            <dd className="text-black/70 dark:text-white/70">
              {report.machinery_entries.length === 0
                ? "—"
                : report.machinery_entries
                    .map((m) => {
                      const key = defaultMachineKey(m.machine_type);
                      const label = key
                        ? t(`machineTypes.${key}`)
                        : m.machine_type;
                      return `${label}: ${m.hours_worked ?? 0}h`;
                    })
                    .join(", ")}
            </dd>
          </div>
          <div>
            <dt className="font-medium">{t("workDone")}</dt>
            <dd className="whitespace-pre-wrap text-black/70 dark:text-white/70">
              {report.work_done || "—"}
            </dd>
          </div>
        </>
      )}
      <div>
        <dt className="font-medium">{t("issues")}</dt>
        <dd className="text-black/70 dark:text-white/70">
          {report.issues.length === 0
            ? "—"
            : report.issues
                .map((i) => `${i.description} [${t(`cat.${i.category}`)}]`)
                .join("; ")}
        </dd>
      </div>
      {report.visitor_entries.length > 0 && (
        <div>
          <dt className="font-medium">{t("visitors")}</dt>
          <dd className="text-black/70 dark:text-white/70">
            {report.visitor_entries
              .map((v) => (v.purpose ? `${v.name} (${v.purpose})` : v.name))
              .join(", ")}
          </dd>
        </div>
      )}
      {report.notes && (
        <div>
          <dt className="font-medium">{t("notes")}</dt>
          <dd className="whitespace-pre-wrap text-black/70 dark:text-white/70">
            {report.notes}
          </dd>
        </div>
      )}
    </dl>
  );
}
