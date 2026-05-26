"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { createDelivery, type DeliveryState } from "@/lib/data/actions";
import { PhotoCapture } from "@/components/photo-capture";
import type { Supplier, Material } from "@/lib/data/catalog";

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

const ISSUE_TYPES = [
  "broken",
  "missing",
  "short",
  "wrong_item",
  "late",
  "other",
] as const;

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
  const month = today.slice(0, 7); // YYYY-MM
  const [issue, setIssue] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [state, action, pending] = useActionState<DeliveryState, FormData>(
    createDelivery,
    undefined,
  );

  const selected = materials.find((m) => m.id === materialId);
  const isOther = materialId === "__other__";
  const showReceived = selected?.count_required ?? false;

  const message =
    state && "ok" in state
      ? t("saved")
      : state && "error" in state
        ? state.error === "validation"
          ? t("emptyError")
          : t("saveError")
        : null;

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-black/10 p-4 dark:border-white/15"
    >
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="issue_type" value={issue} />
      <p className="text-sm font-semibold">{t("newDelivery")}</p>

      {/* Primary: photo of the delivery / DO */}
      <PhotoCapture projectId={projectId} month={month} />

      {/* Issue flag — only if something's wrong */}
      <div className="space-y-2">
        <span className="block text-sm font-medium">{t("issue")}</span>
        <div className="flex flex-wrap gap-2">
          {ISSUE_TYPES.map((it) => {
            const activeChip = issue === it;
            return (
              <button
                key={it}
                type="button"
                onClick={() => setIssue(activeChip ? "" : it)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  activeChip
                    ? "border-foreground bg-foreground text-background"
                    : "border-black/20 dark:border-white/25"
                }`}
              >
                {t(`issueType.${it}`)}
              </button>
            );
          })}
        </div>
        {issue && (
          <textarea
            name="note"
            rows={2}
            placeholder={t("notePlaceholder")}
            className={inputClass}
          />
        )}
      </div>

      {/* Optional structured details (office can also fill these later) */}
      <div>
        <button
          type="button"
          onClick={() => setShowDetails((s) => !s)}
          className="text-xs underline"
        >
          {showDetails ? t("hideDetails") : t("addDetails")}
        </button>
      </div>

      <div className={showDetails ? "space-y-3" : "hidden"}>
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
        {pending ? t("saving") : t("addDelivery")}
      </button>
    </form>
  );
}
