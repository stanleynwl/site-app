"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  createPurchaseRequest,
  type PurchaseRequestState,
} from "@/lib/data/actions";
import { RequestItemsField } from "@/components/request-items-field";
import type { Material } from "@/lib/data/catalog";

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

export function PurchaseRequestForm({
  projectId,
  today,
  materials,
}: {
  projectId: string;
  today: string;
  materials: Material[];
}) {
  const t = useTranslations("Requests");
  const [state, action, pending] = useActionState<PurchaseRequestState, FormData>(
    createPurchaseRequest,
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

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-black/10 p-4 dark:border-white/15"
    >
      <input type="hidden" name="project_id" value={projectId} />
      <p className="text-sm font-semibold">{t("newRequest")}</p>

      <RequestItemsField materials={materials} />

      <label className="block text-sm">
        <span className="mb-1 block">{t("neededBy")}</span>
        <input type="date" name="needed_by" min={today} className={inputClass} />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block">{t("urgencyReason")}</span>
        <input
          name="urgency_reason"
          placeholder={t("urgencyHint")}
          className={inputClass}
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block">{t("note")}</span>
        <textarea name="note" rows={2} className={inputClass} />
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

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? t("saving") : t("addRequest")}
      </button>
    </form>
  );
}
