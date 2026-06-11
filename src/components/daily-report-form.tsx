"use client";

import { useActionState, useState, useEffect, useCallback, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  saveReport,
  checkReportSaved,
  type SaveReportState,
} from "@/lib/data/actions";
import { DEFAULT_TRADES, defaultTradeKey } from "@/lib/trades";
import { DEFAULT_MACHINES, defaultMachineKey } from "@/lib/machines";
import { PhotoCapture } from "@/components/photo-capture";
import { useFormDraft } from "@/lib/use-form-draft";
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
type IssueRow = { id?: string; description: string; category: IssueCategory };
type VisitorRow = { name: string; purpose: string };

type DraftData = {
  reportType: ReportType;
  weather: string;
  rainHours: string;
  noWorkReason: string;
  workDone: string;
  notes: string;
  defaultWorkerCounts: number[];
  customRows: ManpowerRow[];
  machinery: MachineryRow[];
  issues: IssueRow[];
  visitors: VisitorRow[];
};

const baseInput =
  "rounded-lg border border-black/25 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/60 dark:border-white/30 dark:focus:border-white/60";
const inputClass = `w-full ${baseInput}`;

export function DailyReportForm({
  projectId,
  reportDate,
  report,
  preFillManpower,
  preFillMachinery,
  canSoftEdit,
}: {
  projectId: string;
  reportDate: string;
  report: ReportWithChildren | null;
  preFillManpower: ManpowerRow[] | null;
  preFillMachinery: MachinerySource[] | null;
  canSoftEdit: boolean;
}) {
  const t = useTranslations("Report");

  const isSoftEditable = report?.status === "submitted" && canSoftEdit;
  const isHardLocked =
    report != null &&
    (report.status === "locked" ||
      (report.status === "submitted" && !isSoftEditable));

  // Derive initial values from server data or pre-fill.
  const sourceManpower: ManpowerRow[] =
    report?.manpower_entries.map((m) => ({
      trade: m.trade,
      subcontractor: m.subcontractor ?? "",
      worker_count: m.worker_count,
    })) ??
    preFillManpower ??
    [];

  const initialDefaultCounts = DEFAULT_TRADES.map(({ canonical }) => {
    const match = sourceManpower.find((r) => r.trade === canonical);
    return match?.worker_count ?? 0;
  });

  const initialCustom = sourceManpower.filter(
    (r) => defaultTradeKey(r.trade) == null,
  );

  const sourceMachinery: MachinerySource[] | null =
    report?.machinery_entries.map((m) => ({
      machine_type: m.machine_type,
      hours_worked: m.hours_worked,
    })) ??
    preFillMachinery ??
    null;

  const initialMachinery: MachineryRow[] = (sourceMachinery ?? []).map((m) => {
    const hours = m.hours_worked != null ? String(m.hours_worked) : "";
    return defaultMachineKey(m.machine_type)
      ? { type: m.machine_type, custom: "", hours }
      : { type: "__other__", custom: m.machine_type, hours };
  });

  // --- Controlled state (all form fields) ---
  const [reportType, setReportType] = useState<ReportType>(
    report?.report_type ?? "normal",
  );
  const [weather, setWeather] = useState<string>(report?.weather ?? "");
  const [rainHours, setRainHours] = useState<string>(
    report?.rain_hours != null ? String(report.rain_hours) : "",
  );
  const [noWorkReason, setNoWorkReason] = useState<string>(
    report?.no_work_reason ?? "",
  );
  const [workDone, setWorkDone] = useState<string>(report?.work_done ?? "");
  const [notes, setNotes] = useState<string>(report?.notes ?? "");
  const [defaultWorkerCounts, setDefaultWorkerCounts] =
    useState<number[]>(initialDefaultCounts);
  const [customRows, setCustomRows] = useState<ManpowerRow[]>(initialCustom);
  const [machinery, setMachinery] = useState<MachineryRow[]>(initialMachinery);
  const [issues, setIssues] = useState<IssueRow[]>(
    report?.issues.map((i) => ({
      id: i.id,
      description: i.description,
      category: i.category,
    })) ?? [],
  );
  const [visitors, setVisitors] = useState<VisitorRow[]>(
    report?.visitor_entries.map((v) => ({
      name: v.name,
      purpose: v.purpose ?? "",
    })) ?? [],
  );

  // --- Draft persistence (IndexedDB) ---
  const draftKey = `draft:report:${projectId}:${reportDate}`;

  const onRestore = useCallback((data: DraftData) => {
    setReportType(data.reportType);
    setWeather(data.weather);
    setRainHours(data.rainHours);
    setNoWorkReason(data.noWorkReason);
    setWorkDone(data.workDone);
    setNotes(data.notes);
    setDefaultWorkerCounts(data.defaultWorkerCounts);
    setCustomRows(data.customRows);
    setMachinery(data.machinery);
    setIssues(data.issues);
    setVisitors(data.visitors);
  }, []);

  const { isReady, isDraftRestored, saveDraft, clearDraft } =
    useFormDraft<DraftData>(draftKey, onRestore);

  useEffect(() => {
    if (!isReady || isHardLocked) return;
    saveDraft({
      reportType,
      weather,
      rainHours,
      noWorkReason,
      workDone,
      notes,
      defaultWorkerCounts,
      customRows,
      machinery,
      issues,
      visitors,
    });
  }, [
    isReady,
    isHardLocked,
    reportType,
    weather,
    rainHours,
    noWorkReason,
    workDone,
    notes,
    defaultWorkerCounts,
    customRows,
    machinery,
    issues,
    visitors,
    saveDraft,
  ]);

  const router = useRouter();
  const [state, action, pending] = useActionState<SaveReportState, FormData>(
    async (prev, formData) => {
      // On flaky 4G the action's POST response can be lost AFTER the server
      // commits — the supervisor would see "Could not save" for a save that
      // succeeded. So: treat a thrown call as a checkable error, then verify
      // against the server before surfacing the failure.
      const intentSubmit = formData.get("intent") === "submit";
      const sentAt = Date.now();
      let result: SaveReportState;
      try {
        result = await saveReport(prev, formData);
      } catch {
        result = { error: "save" };
      }
      if (
        result &&
        "error" in result &&
        result.error === "save" &&
        navigator.onLine
      ) {
        const check = await checkReportSaved(projectId, reportDate).catch(
          () => null,
        );
        if (
          intentSubmit &&
          check?.exists &&
          check.status === "submitted" &&
          check.submittedAt &&
          Date.parse(check.submittedAt) >= sentAt - 60_000
        ) {
          // The submit DID reach the server. Refresh the server-rendered page
          // state (soft-edit banner etc.) and report success.
          router.refresh();
          return { ok: true, submitted: true };
        }
        // Draft intent stays conservative: a prior draft makes existence
        // ambiguous, and retrying is a harmless idempotent upsert.
      }
      return result;
    },
    undefined,
  );

  // Clear draft after a successful save or submit.
  useEffect(() => {
    if (state && "ok" in state) clearDraft();
  }, [state, clearDraft]);

  // --- Offline detection + auto-retry ---
  const [isOnline, setIsOnline] = useState(true);
  const [needsRetry, setNeedsRetry] = useState(false);
  const lastFormDataRef = useRef<FormData | null>(null);
  const lastIntentRef = useRef<"draft" | "submit">("submit");
  const [, startRetry] = useTransition();

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const up = () => setIsOnline(true);
    const dn = () => setIsOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", dn);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", dn);
    };
  }, []);

  // Mark for retry if save fails while offline.
  useEffect(() => {
    if (state && "error" in state && state.error !== "locked" && !isOnline) {
      setNeedsRetry(true);
    }
    if (state && "ok" in state) setNeedsRetry(false);
  }, [state, isOnline]);

  // Auto-resubmit when network comes back.
  useEffect(() => {
    if (!isOnline || !needsRetry || !lastFormDataRef.current) return;
    setNeedsRetry(false);
    const fd = lastFormDataRef.current;
    startRetry(() => {
      action(fd);
    });
  }, [isOnline, needsRetry, action]);

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
      : needsRetry
        ? t("offlineNotice")
        : state && "error" in state
          ? state.error === "locked"
            ? t("windowExpired")
            : !isOnline
              ? t("offlineNotice")
              : t("saveError")
          : null;

  const isNoWork = reportType === "no_work";

  return (
    <form
      action={action}
      className="space-y-6 pb-36"
      onSubmit={(e) => {
        // Capture FormData + intent for offline retry.
        const fd = new FormData(e.currentTarget);
        fd.set("intent", lastIntentRef.current);
        lastFormDataRef.current = fd;
      }}
    >
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="report_date" value={reportDate} />

      {/* Draft restored banner */}
      {isDraftRestored && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
          <span>{t("draftRestored")}</span>
          <button
            type="button"
            onClick={clearDraft}
            className="shrink-0 underline"
          >
            {t("draftDiscard")}
          </button>
        </div>
      )}

      {/* Amend window banner */}
      {isSoftEditable && (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
          {t("softEditNotice")}
        </p>
      )}

      {/* Report type selector */}
      <section className="grid grid-cols-2 gap-2">
        {(["normal", "no_work"] as ReportType[]).map((type) => (
          <label
            key={type}
            className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
              reportType === type
                ? "border-foreground bg-foreground text-background"
                : "border-black/25 dark:border-white/30"
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
            value={noWorkReason}
            onChange={(e) => setNoWorkReason(e.target.value)}
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

      {/* Weather */}
      <section className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium">{t("weather")}</span>
          <select
            name="weather"
            value={weather}
            onChange={(e) => setWeather(e.target.value)}
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
            value={rainHours}
            onChange={(e) => setRainHours(e.target.value)}
            className={inputClass}
          />
        </label>
      </section>

      {/* Manpower */}
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
              className="min-h-11 rounded px-2 text-xs underline"
            >
              {t("addRow")}
            </button>
          </div>

          {/* Fixed default trades — label localized, value stored canonically */}
          {DEFAULT_TRADES.map((row, i) => (
            <div key={row.key} className="flex items-center gap-3">
              <input type="hidden" name="manpower_trade" value={row.canonical} />
              <span className="flex-1 text-sm">{t(`trades.${row.key}`)}</span>
              <Stepper
                name="manpower_worker_count"
                value={defaultWorkerCounts[i] ?? 0}
                min={0}
                onChange={(v) =>
                  setDefaultWorkerCounts((counts) =>
                    counts.map((c, idx) => (idx === i ? v : c)),
                  )
                }
              />
              <span className="w-9" aria-hidden="true" />
            </div>
          ))}

          {/* Custom trades — free-text, removable */}
          {customRows.map((row, i) => (
            <div key={`custom-${i}`} className="flex items-center gap-3">
              <input
                name="manpower_trade"
                value={row.trade}
                onChange={(e) =>
                  setCustomRows((rows) =>
                    rows.map((r, idx) =>
                      idx === i ? { ...r, trade: e.target.value } : r,
                    ),
                  )
                }
                placeholder={t("trade")}
                className={`${baseInput} flex-1`}
              />
              <Stepper
                name="manpower_worker_count"
                value={row.worker_count}
                min={0}
                onChange={(v) =>
                  setCustomRows((rows) =>
                    rows.map((r, idx) =>
                      idx === i ? { ...r, worker_count: v } : r,
                    ),
                  )
                }
              />
              <button
                type="button"
                onClick={() =>
                  setCustomRows((rows) => rows.filter((_, idx) => idx !== i))
                }
                className="flex min-h-11 min-w-9 items-center justify-center rounded text-sm text-red-600"
                aria-label={t("remove")}
              >
                ✕
              </button>
            </div>
          ))}
        </section>
      )}

      {/* Machinery */}
      {!isNoWork && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("machinery")}</h2>
            <button
              type="button"
              onClick={() =>
                setMachinery((rows) => [
                  ...rows,
                  { type: "", custom: "", hours: "" },
                ])
              }
              className="min-h-11 rounded px-2 text-xs underline"
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
                  <option value="">{t("selectMachine")}</option>
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
                <HoursStepper
                  name="machinery_hours"
                  value={row.hours}
                  onChange={(v) =>
                    setMachinery((rows) =>
                      rows.map((r, idx) =>
                        idx === i ? { ...r, hours: v } : r,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    setMachinery((rows) => rows.filter((_, idx) => idx !== i))
                  }
                  className="flex min-h-11 min-w-9 items-center justify-center rounded text-sm text-red-600"
                  aria-label={t("remove")}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </section>
      )}

      {/* Work done */}
      {!isNoWork && (
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">{t("workDone")}</span>
          <textarea
            name="work_done"
            rows={4}
            value={workDone}
            onChange={(e) => setWorkDone(e.target.value)}
            className={inputClass}
          />
        </label>
      )}

      {/* Issues */}
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
            className="min-h-11 rounded px-2 text-xs underline"
          >
            {t("addRow")}
          </button>
        </div>
        {issues.map((row, i) => (
          <div
            key={i}
            className="space-y-2 rounded-lg border border-black/10 p-2 dark:border-white/15"
          >
            {/* Carries the row identity so saveReport merges by id and the
                office's assignee / closed status survives a same-day edit. */}
            <input type="hidden" name="issue_id" value={row.id ?? ""} />
            <input
              name="issue_description"
              value={row.description}
              onChange={(e) =>
                setIssues((rows) =>
                  rows.map((r, idx) =>
                    idx === i ? { ...r, description: e.target.value } : r,
                  ),
                )
              }
              placeholder={t("issueDescription")}
              className={inputClass}
            />
            <div className="flex items-center gap-3">
              <select
                name="issue_category"
                value={row.category}
                onChange={(e) =>
                  setIssues((rows) =>
                    rows.map((r, idx) =>
                      idx === i
                        ? { ...r, category: e.target.value as IssueCategory }
                        : r,
                    ),
                  )
                }
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
                className="flex min-h-11 min-w-9 items-center justify-center rounded text-sm text-red-600"
                aria-label={t("remove")}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Visitors */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("visitors")}</h2>
          <button
            type="button"
            onClick={() =>
              setVisitors((rows) => [...rows, { name: "", purpose: "" }])
            }
            className="min-h-11 rounded px-2 text-xs underline"
          >
            {t("addRow")}
          </button>
        </div>
        {visitors.map((row, i) => (
          <div key={`visitor-${i}`} className="flex items-center gap-3">
            <input
              name="visitor_name"
              value={row.name}
              onChange={(e) =>
                setVisitors((rows) =>
                  rows.map((r, idx) =>
                    idx === i ? { ...r, name: e.target.value } : r,
                  ),
                )
              }
              placeholder={t("visitorName")}
              className={`${baseInput} flex-1`}
            />
            <input
              name="visitor_purpose"
              value={row.purpose}
              onChange={(e) =>
                setVisitors((rows) =>
                  rows.map((r, idx) =>
                    idx === i ? { ...r, purpose: e.target.value } : r,
                  ),
                )
              }
              placeholder={t("visitorPurpose")}
              className={`${baseInput} flex-1`}
            />
            <button
              type="button"
              onClick={() =>
                setVisitors((rows) => rows.filter((_, idx) => idx !== i))
              }
              className="flex min-h-11 min-w-9 items-center justify-center rounded text-sm text-red-600"
              aria-label={t("remove")}
            >
              ✕
            </button>
          </div>
        ))}
      </section>

      {/* Photos */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("photos")}</h2>
        <PhotoCapture projectId={projectId} month={reportDate.slice(0, 7)} />
      </section>

      {/* Notes */}
      <label className="block text-sm">
        <span className="mb-1 block font-semibold">{t("notes")}</span>
        <textarea
          name="notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
        />
      </label>

      {message && (
        <p
          className={`text-sm ${
            needsRetry || (!isOnline && state && "error" in state)
              ? "text-amber-700 dark:text-amber-400"
              : state && "error" in state
                ? "text-red-600"
                : "text-green-600"
          }`}
        >
          {message}
        </p>
      )}

      {/* Sticky submit bar — always reachable without scrolling. Sits ABOVE the
          app's bottom tab nav (sticky bottom-0, ~60px) so it never covers, or is
          covered by, Today/Projects. */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-black/10 bg-background px-4 py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.07)] dark:border-white/10 dark:shadow-[0_-2px_10px_rgba(0,0,0,0.4)]">
        <div className="mx-auto flex max-w-md gap-2">
          <button
            type="submit"
            name="intent"
            value="draft"
            disabled={pending}
            onClick={() => { lastIntentRef.current = "draft"; }}
            className="flex-1 rounded-lg border border-black/20 px-3 py-3 text-sm font-medium disabled:opacity-50 dark:border-white/25"
          >
            {pending ? t("saving") : needsRetry ? t("retrying") : t("saveDraft")}
          </button>
          <button
            type="submit"
            name="intent"
            value="submit"
            disabled={pending}
            onClick={() => { lastIntentRef.current = "submit"; }}
            className="flex-1 rounded-lg bg-foreground px-3 py-3 text-sm font-medium text-background disabled:opacity-50"
          >
            {t("submit")}
          </button>
        </div>
      </div>
    </form>
  );
}

// --- Stepper for integer counts (manpower worker counts) ---
function Stepper({
  name,
  value,
  min = 0,
  onChange,
}: {
  name: string;
  value: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-10 w-10 items-center justify-center rounded-l-lg border border-black/25 text-base font-medium dark:border-white/30"
        aria-label="−"
      >
        −
      </button>
      <input
        name={name}
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Math.max(min, parseInt(e.target.value, 10) || 0))}
        className="h-10 w-14 border-y border-black/25 bg-transparent text-center text-sm outline-none dark:border-white/30"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="flex h-10 w-10 items-center justify-center rounded-r-lg border border-black/25 text-base font-medium dark:border-white/30"
        aria-label="+"
      >
        +
      </button>
    </div>
  );
}

// --- Stepper for decimal hours (machinery) ---
function HoursStepper({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const num = parseFloat(value) || 0;
  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={() => onChange(String(Math.max(0, Math.round((num - 0.5) * 10) / 10)))}
        className="flex h-10 w-10 items-center justify-center rounded-l-lg border border-black/25 text-base font-medium dark:border-white/30"
        aria-label="−"
      >
        −
      </button>
      <input
        name={name}
        type="number"
        min="0"
        step="0.5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="h"
        className="h-10 w-14 border-y border-black/25 bg-transparent text-center text-sm outline-none dark:border-white/30"
      />
      <button
        type="button"
        onClick={() => onChange(String(Math.round((num + 0.5) * 10) / 10))}
        className="flex h-10 w-10 items-center justify-center rounded-r-lg border border-black/25 text-base font-medium dark:border-white/30"
        aria-label="+"
      >
        +
      </button>
    </div>
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
