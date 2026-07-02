"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { createDelivery, type DeliveryState } from "@/lib/data/actions";
import { PhotoCapture } from "@/components/photo-capture";
import type { Supplier, Material } from "@/lib/data/catalog";

const inputClass =
  "w-full rounded-lg border border-black/25 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/60 dark:border-white/30 dark:focus:border-white/60";

const ISSUE_TYPES = [
  "broken",
  "missing",
  "short",
  "wrong_item",
  "late",
  "other",
] as const;

// An ordered request the DO can be recorded against (serializable — built
// server-side since purchase-requests.ts is server-only).
export type OpenOrder = {
  id: string;
  label: string; // items summary, e.g. "Timber 1x2 (4 tonne), Timber 2x3 (2 tonne)"
  items: {
    id: string;
    name: string;
    quantity: number | null; // ordered
    unit: string | null;
    remaining: number | null; // ordered − delivered so far (null if uncounted)
  }[];
};

export function DeliveryForm({
  projectId,
  today,
  suppliers,
  materials,
  openOrders = [],
}: {
  projectId: string;
  today: string;
  suppliers: Supplier[];
  materials: Material[];
  openOrders?: OpenOrder[];
}) {
  const t = useTranslations("Deliveries");
  const month = today.slice(0, 7); // YYYY-MM
  const [issue, setIssue] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [completeness, setCompleteness] = useState("");
  const [state, action, pending] = useActionState<DeliveryState, FormData>(
    createDelivery,
    undefined,
  );

  const selected = materials.find((m) => m.id === materialId);
  const isOther = materialId === "__other__";
  const showReceived = selected?.count_required ?? false;
  const order = openOrders.find((o) => o.id === requestId) ?? null;

  const message =
    state && "ok" in state
      ? t("saved")
      : state && "error" in state
        ? state.error === "validation"
          ? t("emptyError")
          : state.error === "completeness"
            ? t("completenessError")
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

      {/* Which order is this DO for? (only when there are ordered requests) */}
      {openOrders.length > 0 && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t("forRequest")}</span>
          <select
            name="request_id"
            value={requestId}
            onChange={(e) => {
              setRequestId(e.target.value);
              setCompleteness("");
            }}
            className={inputClass}
          >
            <option value="">{t("requestOthers")}</option>
            {openOrders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Request mode: items with optional received-this-DO qty + completeness */}
      {order && (
        <div className="space-y-3 rounded-lg border border-black/10 p-3 dark:border-white/15">
          <ul className="space-y-2">
            {order.items.map((it) => (
              <li key={it.id} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{it.name}</span>
                  {it.quantity != null && (
                    <span className="shrink-0 text-xs text-black/50 dark:text-white/50">
                      {it.quantity}
                      {it.unit ? ` ${it.unit}` : ""}
                    </span>
                  )}
                </div>
                <label className="flex items-center gap-2 text-xs text-black/60 dark:text-white/60">
                  <span className="shrink-0">{t("receivedThisDo")}</span>
                  <input
                    type="number"
                    name={`received_${it.id}`}
                    min="0"
                    step="0.001"
                    placeholder={
                      it.remaining != null && it.quantity != null
                        ? t("remainingHint", {
                            remaining: it.remaining,
                            ordered: it.quantity,
                          })
                        : ""
                    }
                    className={`${inputClass} py-1.5`}
                  />
                  {it.unit && <span className="shrink-0">{it.unit}</span>}
                </label>
              </li>
            ))}
          </ul>

          {/* Explicit completeness choice — qty keying is optional, so the
              site says whether the order is now complete. */}
          <div className="space-y-1.5">
            <span className="block text-sm font-medium">{t("completeness")}</span>
            <div className="flex flex-wrap gap-2">
              {(["delivered", "partial"] as const).map((c) => {
                const active = completeness === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCompleteness(c)}
                    className={`flex min-h-11 items-center rounded-full border px-4 text-xs font-medium transition-colors ${
                      active
                        ? c === "delivered"
                          ? "border-green-700 bg-green-700 text-white"
                          : "border-amber-600 bg-amber-600 text-white"
                        : "border-black/20 dark:border-white/25"
                    }`}
                  >
                    {c === "delivered" ? t("completeAll") : t("completePartial")}
                  </button>
                );
              })}
            </div>
            <input type="hidden" name="completeness" value={completeness} />
          </div>
        </div>
      )}

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
                className={`flex min-h-11 items-center rounded-full border px-3 text-xs font-medium transition-colors ${
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
          className="flex min-h-11 items-center px-1 text-xs underline"
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

        {/* Material only applies to "Others" — in request mode it comes from
            the request's items. */}
        {!order && (
          <>
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
          </>
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

        {!order && showReceived && (
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
        className="min-h-12 w-full rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? t("saving") : t("addDelivery")}
      </button>
    </form>
  );
}
