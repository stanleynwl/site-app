"use client";

import { useActionState, useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  createPurchaseRequest,
  type PurchaseRequestState,
} from "@/lib/data/actions";
import { RequestItemsField } from "@/components/request-items-field";
import { PhotoCapture } from "@/components/photo-capture";
import { useFormDraft } from "@/lib/use-form-draft";
import type { Material } from "@/lib/data/catalog";

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

export type RequestItemRow = {
  query: string;
  materialId: string;
  unit: string;
  quantity: string;
  spec: string;
};

const blankRow = (): RequestItemRow => ({
  query: "",
  materialId: "",
  unit: "",
  quantity: "",
  spec: "",
});

type DraftData = {
  items: RequestItemRow[];
  neededBy: string;
  urgencyReason: string;
  note: string;
};

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

  // Lifted item rows state (passed down to RequestItemsField).
  const [items, setItems] = useState<RequestItemRow[]>([blankRow()]);

  // Controlled header fields.
  const [neededBy, setNeededBy] = useState("");
  const [urgencyReason, setUrgencyReason] = useState("");
  const [note, setNote] = useState("");

  // Draft persistence — per project (one active draft at a time).
  const draftKey = `draft:request:${projectId}`;

  const onRestore = useCallback((data: DraftData) => {
    setItems(data.items);
    setNeededBy(data.neededBy);
    setUrgencyReason(data.urgencyReason);
    setNote(data.note);
  }, []);

  const { isReady, isDraftRestored, saveDraft, clearDraft } =
    useFormDraft<DraftData>(draftKey, onRestore);

  useEffect(() => {
    if (!isReady) return;
    saveDraft({ items, neededBy, urgencyReason, note });
  }, [isReady, items, neededBy, urgencyReason, note, saveDraft]);

  const [state, action, pending] = useActionState<PurchaseRequestState, FormData>(
    createPurchaseRequest,
    undefined,
  );

  useEffect(() => {
    if (state && "ok" in state) {
      clearDraft();
      // Reset form fields after successful submit.
      setItems([blankRow()]);
      setNeededBy("");
      setUrgencyReason("");
      setNote("");
    }
  }, [state, clearDraft]);

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

      <p className="text-sm font-semibold">{t("newRequest")}</p>

      <RequestItemsField
        materials={materials}
        rows={items}
        setRows={setItems}
      />

      <label className="block text-sm">
        <span className="mb-1 block">{t("neededBy")}</span>
        <input
          type="date"
          name="needed_by"
          min={today}
          value={neededBy}
          onChange={(e) => setNeededBy(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block">{t("urgencyReason")}</span>
        <input
          name="urgency_reason"
          placeholder={t("urgencyHint")}
          value={urgencyReason}
          onChange={(e) => setUrgencyReason(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block">{t("note")}</span>
        <textarea
          name="note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={inputClass}
        />
      </label>

      <div className="space-y-1 text-sm">
        <span className="block font-medium">{t("photo")}</span>
        <span className="block text-xs text-black/50 dark:text-white/50">
          {t("photoHint")}
        </span>
        <PhotoCapture projectId={projectId} month={today.slice(0, 7)} />
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
        className="min-h-12 w-full rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? t("saving") : t("addRequest")}
      </button>
    </form>
  );
}
