"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { createDelivery, type DeliveryState } from "@/lib/data/actions";
import type { Supplier, Material } from "@/lib/data/catalog";

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

export function DeliveryForm({
  projectId,
  today,
  suppliers,
  materials,
}: {
  projectId: string;
  today: string;
  suppliers: Supplier[];
  materials: Material[];
}) {
  const t = useTranslations("Deliveries");
  const [materialId, setMaterialId] = useState("");
  const [state, action, pending] = useActionState<DeliveryState, FormData>(
    createDelivery,
    undefined,
  );

  const selected = materials.find((m) => m.id === materialId);
  const isOther = materialId === "__other__";
  // received_quantity only matters for materials flagged count_required.
  const showReceived = selected?.count_required ?? false;

  const message =
    state && "ok" in state
      ? t("saved")
      : state && "error" in state
        ? state.error === "validation"
          ? t("validationError")
          : t("saveError")
        : null;

  return (
    <form action={action} className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/15">
      <input type="hidden" name="project_id" value={projectId} />
      <p className="text-sm font-semibold">{t("newDelivery")}</p>

      <label className="block text-sm">
        <span className="mb-1 block">{t("supplier")}</span>
        <select name="supplier_id" defaultValue="" className={inputClass}>
          <option value="">—</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block">{t("material")}</span>
        <select
          name="material_id"
          value={materialId}
          onChange={(e) => setMaterialId(e.target.value)}
          className={inputClass}
        >
          <option value="">—</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.unit ? ` (${m.unit})` : ""}
            </option>
          ))}
          <option value="__other__">{t("otherMaterial")}</option>
        </select>
      </label>

      {isOther && (
        <label className="block text-sm">
          <span className="mb-1 block">{t("materialText")}</span>
          <input name="material_text" className={inputClass} />
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block">{t("doNumber")}</span>
          <input name="do_number" className={inputClass} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">{t("deliveredOn")}</span>
          <input
            type="date"
            name="delivered_on"
            defaultValue={today}
            max={today}
            className={inputClass}
          />
        </label>
      </div>

      {/* Received quantity — only for count-required materials */}
      {showReceived && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block">{t("receivedQuantity")}</span>
            <input
              type="number"
              name="received_quantity"
              min="0"
              step="0.001"
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
        {pending ? t("saving") : t("addDelivery")}
      </button>
    </form>
  );
}
