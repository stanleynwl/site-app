"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { recordStockCount, type StockCountState } from "@/lib/data/actions";
import type { Material } from "@/lib/data/catalog";

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

export function StockCountForm({
  projectId,
  today,
  materials,
}: {
  projectId: string;
  today: string;
  materials: Material[];
}) {
  const t = useTranslations("Stock");
  const [materialId, setMaterialId] = useState("");
  const [state, action, pending] = useActionState<StockCountState, FormData>(
    recordStockCount,
    undefined,
  );

  const selected = materials.find((m) => m.id === materialId);

  const message =
    state && "ok" in state
      ? t("saved")
      : state && "error" in state
        ? state.error === "validation"
          ? t("emptyError")
          : t("saveError")
        : null;

  if (materials.length === 0) {
    return (
      <p className="rounded-xl border border-black/10 p-4 text-sm text-black/50 dark:border-white/15 dark:text-white/50">
        {t("noMaterials")}
      </p>
    );
  }

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-black/10 p-4 dark:border-white/15"
    >
      <input type="hidden" name="project_id" value={projectId} />
      <p className="text-sm font-semibold">{t("newCount")}</p>

      <label className="block text-sm">
        <span className="mb-1 block">{t("material")}</span>
        <select
          name="material_id"
          value={materialId}
          onChange={(e) => setMaterialId(e.target.value)}
          required
          className={inputClass}
        >
          <option value="" disabled>
            —
          </option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.unit ? ` (${m.unit})` : ""}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block">{t("quantity")}</span>
          <input
            type="number"
            name="quantity"
            min="0"
            step="0.001"
            required
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">{t("unit")}</span>
          <input
            name="unit"
            defaultValue={selected?.unit ?? ""}
            className={inputClass}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block">{t("date")}</span>
          <input
            type="date"
            name="count_date"
            defaultValue={today}
            max={today}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">{t("note")}</span>
          <input name="note" className={inputClass} />
        </label>
      </div>

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
        {pending ? t("saving") : t("addCount")}
      </button>
    </form>
  );
}
