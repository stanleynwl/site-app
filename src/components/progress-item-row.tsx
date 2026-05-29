"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { submitProgress } from "@/lib/data/actions";
import { PhotoCapture } from "@/components/photo-capture";

const baseInput =
  "rounded-lg border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

// One progress item: shows units done / total, lets the supervisor update the
// cumulative units-done, and (optionally) snap a photo with the submission.
export function ProgressItemRow({
  itemId,
  projectId,
  label,
  unitsDone,
  unitCount,
  month,
}: {
  itemId: string;
  projectId: string;
  label: string;
  unitsDone: number;
  unitCount: number | null;
  month: string;
}) {
  const t = useTranslations("Progress");
  const [showPhoto, setShowPhoto] = useState(false);
  const done = unitCount != null && unitCount > 0 && unitsDone >= unitCount;

  return (
    <form action={submitProgress} className="space-y-2 py-2">
      <input type="hidden" name="item_id" value={itemId} />
      <input type="hidden" name="project_id" value={projectId} />

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className={done ? "text-green-700 dark:text-green-400" : "font-medium"}>
          {done ? "✓ " : ""}
          {label}
        </span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            name="units_done"
            min="0"
            max={unitCount ?? undefined}
            defaultValue={unitsDone}
            className={`${baseInput} w-16 text-right`}
            aria-label={t("unitsDone")}
          />
          <span className="text-xs text-black/50 dark:text-white/50">
            / {unitCount ?? "—"}
          </span>
          <button
            type="button"
            onClick={() => setShowPhoto((v) => !v)}
            className="text-xs underline"
          >
            {t("addPhoto")}
          </button>
          <button className="rounded-lg border border-black/20 px-3 py-1 text-xs font-medium dark:border-white/25">
            {t("save")}
          </button>
        </div>
      </div>

      {showPhoto && <PhotoCapture projectId={projectId} month={month} />}
    </form>
  );
}
