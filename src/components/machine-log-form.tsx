"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { logMachine, type MachineLogState } from "@/lib/data/actions";
import type { Machine } from "@/lib/data/machinery";

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

export function MachineLogForm({
  projectId,
  today,
  machines,
}: {
  projectId: string;
  today: string;
  machines: Machine[];
}) {
  const t = useTranslations("Machinery");
  const [breakdown, setBreakdown] = useState(false);
  const [state, action, pending] = useActionState<MachineLogState, FormData>(
    logMachine,
    undefined,
  );

  const message =
    state && "ok" in state
      ? t("saved")
      : state && "error" in state
        ? state.error === "validation"
          ? t("emptyError")
          : t("saveError")
        : null;

  if (machines.length === 0) {
    return (
      <p className="rounded-xl border border-black/10 p-4 text-sm text-black/50 dark:border-white/15 dark:text-white/50">
        {t("noMachines")}
      </p>
    );
  }

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-black/10 p-4 dark:border-white/15"
    >
      <input type="hidden" name="project_id" value={projectId} />
      <p className="text-sm font-semibold">{t("newLog")}</p>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block">{t("machine")}</span>
          <select name="machine_id" defaultValue="" required className={inputClass}>
            <option value="" disabled>
              —
            </option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code ? `${m.name} (${m.code})` : m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">{t("date")}</span>
          <input
            type="date"
            name="log_date"
            defaultValue={today}
            max={today}
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="present" defaultChecked className="h-4 w-4" />
        <span>{t("present")}</span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block">{t("hours")}</span>
          <input
            type="number"
            name="hours_worked"
            min="0"
            step="0.5"
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">{t("operator")}</span>
          <input name="operator" className={inputClass} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block">{t("fuel")}</span>
          <input
            type="number"
            name="fuel_litres"
            min="0"
            step="0.1"
            placeholder={t("fuelHint")}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">{t("fuelNote")}</span>
          <input name="fuel_note" className={inputClass} />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="breakdown"
          checked={breakdown}
          onChange={(e) => setBreakdown(e.target.checked)}
          className="h-4 w-4"
        />
        <span>{t("breakdown")}</span>
      </label>
      {breakdown && (
        <textarea
          name="breakdown_note"
          rows={2}
          placeholder={t("breakdownHint")}
          className={inputClass}
        />
      )}

      {message && (
        <p
          className={`text-sm ${
            state && "error" in state ? "text-red-600" : "text-green-600"
          }`}
        >
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? t("saving") : t("addLog")}
      </button>
    </form>
  );
}
