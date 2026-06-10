"use client";

import { useState, useOptimistic, useRef } from "react";
import { useTranslations } from "next-intl";
import { submitProgress } from "@/lib/data/actions";
import { PhotoCapture } from "@/components/photo-capture";
import { SubmitButton } from "@/components/submit-button";

const baseInput =
  "rounded-lg border border-black/25 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/60 dark:border-white/30 dark:focus:border-white/60";

export function ProgressItemRow({
  itemId,
  projectId,
  label,
  unitsDone,
  unitCount,
  month,
  photos = [],
}: {
  itemId: string;
  projectId: string;
  label: string;
  unitsDone: number;
  unitCount: number | null;
  month: string;
  photos?: { id: string; url?: string | null }[];
}) {
  const t = useTranslations("Progress");
  const [showPhoto, setShowPhoto] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Optimistic: show the new value immediately while the server action is in flight.
  const [optimisticDone, setOptimisticDone] = useOptimistic(unitsDone);

  const done = unitCount != null && unitCount > 0 && optimisticDone >= unitCount;
  const saved = photos.filter((p) => p.url);

  async function handleSubmit(formData: FormData) {
    const val = Number(formData.get("units_done")) || 0;
    setOptimisticDone(val);
    await submitProgress(formData);
  }

  return (
    <form action={handleSubmit} className="space-y-2 py-2">
      <input type="hidden" name="item_id" value={itemId} />
      <input type="hidden" name="project_id" value={projectId} />

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className={done ? "text-green-700 dark:text-green-400" : "font-medium"}>
          {done ? "✓ " : ""}
          {label}
        </span>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="number"
            name="units_done"
            min="0"
            max={unitCount ?? undefined}
            defaultValue={optimisticDone}
            key={optimisticDone}
            className={`${baseInput} w-16 text-right`}
            aria-label={t("unitsDone")}
          />
          <span className="text-xs text-black/60 dark:text-white/60">
            / {unitCount ?? "—"}
          </span>
          <button
            type="button"
            onClick={() => setShowPhoto((v) => !v)}
            className="flex min-h-11 items-center px-1 text-xs underline"
          >
            {t("addPhoto")}
          </button>
          <SubmitButton className="flex min-h-11 items-center rounded-lg border border-black/25 px-3 text-xs font-medium disabled:opacity-50 dark:border-white/30">
            {t("save")}
          </SubmitButton>
        </div>
      </div>

      {saved.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {saved.map((p) => (
            <a key={p.id} href={p.url!} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url!}
                alt=""
                className="h-14 w-14 rounded-lg object-cover"
              />
            </a>
          ))}
        </div>
      )}

      {showPhoto && <PhotoCapture projectId={projectId} month={month} />}
    </form>
  );
}
