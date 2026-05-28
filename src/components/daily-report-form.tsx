"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { saveReport, type SaveReportState } from "@/lib/data/actions";
import { DEFAULT_TRADES, defaultTradeKey } from "@/lib/trades";
import { DEFAULT_MACHINES, defaultMachineKey } from "@/lib/machines";
import type {
  IssueCategory,
  NoWorkReason,
  ReportType,
  ReportWithChildren,
  Weather,
} from "@/lib/data/reports";

type MachinerySource = { machine_type: string; hours_worked: number | null };
type MachineryRow = { type: string; custom: string; hours: string };

const WEATHERS: Weather[] = ["sunny", "cloudy", "light_rain", "heavy_rain"];
const CATEGORIES: IssueCategory[] = ["material", "weather", "consultant", "other"];
const NO_WORK_REASONS: NoWorkReason[] = ["holiday", "weather", "site_closed", "other"];

type ManpowerRow = { trade: string; subcontractor: string; worker_count: number };
type IssueRow = { description: string; category: IssueCategory };
type VisitorRow = { name: string; purpose: string };

const baseInput =
  "rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";
const inputClass = `w-full ${baseInput}`;

export function DailyReportForm({
  projectId,
  reportDate,
  report,
  preFillManpower,
  preFillMachinery,
  softEditMinutesLeft,
}: {
  projectId: string;
  // Calendar date this report is for (today, or a past date being backfilled).
  reportDate: string;
  report: ReportWithChildren | null;
  // Pre-fill policy: manpower + machinery from yesterday when no report exists today.
  // null means no pre-fill available (no yesterday report, or today draft already exists).
  preFillManpower: ManpowerRow[] | null;
  preFillMachinery: MachinerySource[] | null;
  softEditMinutesLeft: number;
}) {
  const t = useTranslations("Report");

  // A submitted report with time left is still soft-editable by the author.
  const isSoftEditable = report?.status === "submitted" && softEditMinutesLeft > 0;

  // Hard-locked: status=locked, OR status=submitted with expired window.
  const isHardLocked =
    report != null &&
    (report.status === "locked" ||
      (report.status === "submitted" && !isSoftEditable));

  // Source manpower rows: existing report > yesterday pre-fill > none.
  const sourceManpower: ManpowerRow[] =
    report?.manpower_entries.map((m) => ({
      trade: m.trade,
      subcontractor: m.subcontractor ?? "",
      worker_count: m.worker_count,
    })) ??
    preFillManpower ??
    [];

  // Fixed default-trade rows (always shown, translated label, canonical stored).
  // Pre-filled from any matching source row by canonical trade name.
  const defaultRows = DEFAULT_TRADES.map(({ key, canonical }) => {
    const match = sourceManpower.find((r) => r.trade === canonical);
    return {
      key,
      canonical,
      subcontractor: match?.subcontractor ?? "",
      worker_count: match?.worker_count ?? 0,
    };
  });

  // Anything in the source that isn't a known default → editable custom rows.
  const initialCustom = sourceManpower.filter(
    (r) => defaultTradeKey(r.trade) == null,
  );

  // Machinery rows: existing report > yesterday pre-fill > the default machine
  // types. Each row is one machine + hours (repeat a type for multiple units).
  const sourceMachinery: MachinerySource[] | null =
    report?.machinery_entries.map((m) => ({
      machine_type: m.machine_type,
      hours_worked: m.hours_worked,
    })) ??
    preFillMachinery ??
    null;

  const initialMachinery: MachineryRow[] =
    sourceMachinery && sourceMachinery.length > 0
      ? sourceMachinery.map((m) => {
          const hours = m.hours_worked != null ? String(m.hours_worked) : "";
          return defaultMachineKey(m.machine_type)
            ? { type: m.machine_type, custom: "", hours }
            : { type: "__other__", custom: m.machine_type, hours };
        })
      : DEFAULT_MACHINES.map((d) => ({ type: d.canonical, custom: "", hours: "" }));

  const [reportType, setReportType] = useState<ReportType>(
    report?.report_type ?? "normal",
  );
  const [customRows, setCustomRows] = useState<ManpowerRow[]>(initialCustom);
  const [machinery, setMachinery] = useState<MachineryRow[]>(initialMachinery);
  const [issues, setIssues] = useState<IssueRow[]>(
    report?.issues.map((i) => ({
      description: i.description,
      category: i.category,
    })) ?? [],
  );
  // Visitors: policy is NO pre-fill — initialise from the existing report only.
  const [visitors, setVisitors] = useState<VisitorRow[]>(
    report?.visitor_entries.map((v) => ({
      name: v.name,
      purpose: v.purpose ?? "",
    })) ?? [],
  );

  const [state, action, pending] = useActionState<SaveReportState, FormData>(
    saveReport,
    undefined,
  );

  if (isHardLocked) {
    return (
      <div className="space-y-3">
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {t("lockedNotice")}
        </p>
        <ReadOnlyReport report={report} />
      </div>
    );
  }

  const message =
    state && "ok" in state
      ? state.submitted
        ? t("submittedOk")
        : t("savedDraft")
      : state && "error" in state
        ? state.error === "locked"
          ? t("windowExpired")
          : t("saveError")
        : null;

  const isNoWork = reportType === "no_work";

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="report_date" value={reportDate} />

      {/* Soft-edit window banner */}
      {isSoftEditable && (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
          {t("softEditNotice", { minutes: softEditMinutesLeft })}
        </p>
      )}

      {/* Report type selector */}
      <section className="grid grid-cols-2 gap-2">
        {(["normal", "no_work"] as ReportType[]).map((type) => (
          <label
            key={type}
            className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              reportType === type
                ? "border-foreground bg-foreground text-background"
                : "border-black/15 dark:border-white/20"
            }`}
          >
            <input
              type="radio"
              name="report_type"
              value={type}
              checked={reportType === type}
              onChange={() => setReportType(type)}
              className="sr-only"
            />
            {t(`reportType.${type}`)}
          </label>
        ))}
      </section>

      {/* No-work reason */}
      {isNoWork && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t("noWorkReason")}</span>
          <select
            name="no_work_reason"
            defaultValue={report?.no_work_reason ?? ""}
            className={inputClass}
          >
            <option value="">—</option>
            {NO_WORK_REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`noWorkReasonOpt.${r}`)}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Weather — policy: NOT pre-filled; always blank on a new report */}
      <section className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium">{t("weather")}</span>
          <select
            name="weather"
            defaultValue={report?.weather ?? ""}
            className={inputClass}
          >
            <option value="">—</option>
            {WEATHERS.map((w) => (
              <option key={w} value={w}>
                {t(`weatherOpt.${w}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">{t("rainHours")}</span>
          <input
            type="number"
            name="rain_hours"
            min="0"
            step="0.5"
            defaultValue={report?.rain_hours ?? ""}
            className={inputClass}
          />
        </label>
      </section>

      {/* Manpower — fixed default trades (translated label, canonical value
          stored via hidden field) followed by editable custom rows. */}
      {!isNoWork && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("manpower")}</h2>
            <button
              type="button"
              onClick={() =>
                setCustomRows((rows) => [
                  ...rows,
                  { trade: "", subcontractor: "", worker_count: 0 },
                ])
              }
              className="text-xs underline"
            >
              {t("addRow")}
            </button>
          </div>

          {/* Fixed default trades — label localized, value stored canonically */}
          {defaultRows.map((row) => (
            <div key={row.key} className="flex items-center gap-3">
              <input type="hidden" name="manpower_trade" value={row.canonical} />
              <span className="flex-1 text-sm">{t(`trades.${row.key}`)}</span>
              <input
                name="manpower_worker_count"
                type="number"
                min="0"
                defaultValue={row.worker_count}
                placeholder={t("workers")}
                className={`${baseInput} w-24 text-right`}
              />
              {/* spacer to align with custom rows' remove button */}
              <span className="w-5" aria-hidden="true" />
            </div>
          ))}

          {/* Custom trades — free-text, removable */}
          {customRows.map((row, i) => (
            <div key={`custom-${i}`} className="flex items-center gap-3">
              <input
                name="manpower_trade"
                defaultValue={row.trade}
                placeholder={t("trade")}
                className={`${baseInput} flex-1`}
              />
              <input
                name="manpower_worker_count"
                type="number"
                min="0"
                defaultValue={row.worker_count}
                placeholder={t("workers")}
                className={`${baseInput} w-24 text-right`}
              />
              <button
                type="button"
                onClick={() =>
                  setCustomRows((rows) => rows.filter((_, idx) => idx !== i))
                }
                className="w-5 text-xs text-red-600"
                aria-label={t("remove")}
              >
                ✕
              </button>
            </div>
          ))}
        </section>
      )}

      {/* Machinery — one row per machine + hours. Repeat a type for multiple
          units (e.g. backhoe 8h + backhoe 4h when one broke down). */}
      {!isNoWork && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("machinery")}</h2>
            <button
              type="button"
              onClick={() =>
                setMachinery((rows) => [
                  ...rows,
                  { type: DEFAULT_MACHINES[0].canonical, custom: "", hours: "" },
                ])
              }
              className="text-xs underline"
            >
              {t("addRow")}
            </button>
          </div>

          {machinery.map((row, i) => {
            const isOther = row.type === "__other__";
            const effType = isOther ? row.custom : row.type;
            return (
              <div key={`mach-${i}`} className="flex items-center gap-3">
                <input type="hidden" name="machinery_type" value={effType} />
                <select
                  value={row.type}
                  onChange={(e) =>
                    setMachinery((rows) =>
                      rows.map((r, idx) =>
                        idx === i ? { ...r, type: e.target.value } : r,
                      ),
                    )
                  }
                  className={`${baseInput} flex-1`}
                >
                  {DEFAULT_MACHINES.map((d) => (
                    <option key={d.key} value={d.canonical}>
                      {t(`machineTypes.${d.key}`)}
                    </option>
                  ))}
                  <option value="__other__">{t("otherMachine")}</option>
                </select>
                {isOther && (
                  <input
                    value={row.custom}
                    onChange={(e) =>
                      setMachinery((rows) =>
                        rows.map((r, idx) =>
                          idx === i ? { ...r, custom: e.target.value } : r,
                        ),
                      )
                    }
                    placeholder={t("machineType")}
                    className={`${baseInput} flex-1`}
                  />
                )}
                <input
                  name="machinery_hours"
                  type="number"
                  min="0"
                  step="0.5"
                  value={row.hours}
                  onChange={(e) =>
                    setMachinery((rows) =>
                      rows.map((r, idx) =>
                        idx === i ? { ...r, hours: e.target.value } : r,
                      ),
                    )
                  }
                  placeholder={t("hours")}
                  className={`${baseInput} w-24 text-right`}
                />
                <button
                  type="button"
                  onClick={() =>
                    setMachinery((rows) => rows.filter((_, idx) => idx !== i))
                  }
                  className="w-5 text-xs text-red-600"
                  aria-label={t("remove")}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </section>
      )}

      {/* Work done — policy: NEVER pre-filled */}
      {!isNoWork && (
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">{t("workDone")}</span>
          <textarea
            name="work_done"
            rows={4}
            defaultValue={report?.work_done ?? ""}
            className={inputClass}
          />
        </label>
      )}

      {/* Issues — shown for all report types */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("issues")}</h2>
          <button
            type="button"
            onClick={() =>
              setIssues((rows) => [
                ...rows,
                { description: "", category: "other" },
              ])
            }
            className="text-xs underline"
          >
            {t("addRow")}
          </button>
        </div>
        {issues.map((row, i) => (
          <div
            key={i}
            className="space-y-2 rounded-lg border border-black/10 p-2 dark:border-white/15"
          >
            <input
              name="issue_description"
              defaultValue={row.description}
              placeholder={t("issueDescription")}
              className={inputClass}
            />
            <div className="flex items-center gap-3">
              <select
                name="issue_category"
                defaultValue={row.category}
                className={`${baseInput} flex-1`}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`cat.${c}`)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  setIssues((rows) => rows.filter((_, idx) => idx !== i))
                }
                className="w-5 text-xs text-red-600"
                aria-label={t("remove")}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Visitors — secondary, optional; shown for all report types; no pre-fill */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("visitors")}</h2>
          <button
            type="button"
            onClick={() =>
              setVisitors((rows) => [...rows, { name: "", purpose: "" }])
            }
            className="text-xs underline"
          >
            {t("addRow")}
          </button>
        </div>
        {visitors.map((row, i) => (
          <div key={`visitor-${i}`} className="flex items-center gap-3">
            <input
              name="visitor_name"
              defaultValue={row.name}
              placeholder={t("visitorName")}
              className={`${baseInput} flex-1`}
            />
            <input
              name="visitor_purpose"
              defaultValue={row.purpose}
              placeholder={t("visitorPurpose")}
              className={`${baseInput} flex-1`}
            />
            <button
              type="button"
              onClick={() =>
                setVisitors((rows) => rows.filter((_, idx) => idx !== i))
              }
              className="w-5 text-xs text-red-600"
              aria-label={t("remove")}
            >
              ✕
            </button>
          </div>
        ))}
      </section>

      {/* Notes — policy: NEVER pre-filled */}
      <label className="block text-sm">
        <span className="mb-1 block font-semibold">{t("notes")}</span>
        <textarea
          name="notes"
          rows={2}
          defaultValue={report?.notes ?? ""}
          className={inputClass}
        />
      </label>

      {message && (
        <p
          className={`text-sm ${
            state && "error" in state ? "text-red-600" : "text-green-600"
          }`}
        >
          {message}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          name="intent"
          value="draft"
          disabled={pending}
          className="flex-1 rounded-lg border border-black/20 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-white/25"
        >
          {pending ? t("saving") : t("saveDraft")}
        </button>
        <button
          type="submit"
          name="intent"
          value="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {t("submit")}
        </button>
      </div>
    </form>
  );
}

function ReadOnlyReport({ report }: { report: ReportWithChildren }) {
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
