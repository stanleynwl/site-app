"use client";

import { useState, useOptimistic } from "react";
import { useTranslations } from "next-intl";
import { setStageComplete, deleteBlockStage } from "@/lib/data/actions";
import { PhotoCapture } from "@/components/photo-capture";

// One stage: mark complete (with an optional photo) / undo, and delete if it's a
// site-added custom extra. Stages are binary — no units.
export function StageRow({
  stageId,
  projectId,
  name,
  isCustom,
  completedAt,
  month,
}: {
  stageId: string;
  projectId: string;
  name: string;
  isCustom: boolean;
  completedAt: string | null;
  month: string;
}) {
  const t = useTranslations("Stages");
  const [showPhoto, setShowPhoto] = useState(false);

  // Optimistic: reflect the tap immediately; rolls back if the server errors.
  const [optimisticDone, setOptimisticDone] = useOptimistic(completedAt != null);

  async function handleComplete(formData: FormData) {
    const next = formData.get("done") === "1";
    setOptimisticDone(next);
    await setStageComplete(formData);
  }

  return (
    <div className="space-y-2 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={optimisticDone ? "text-black/60 line-through dark:text-white/60" : "font-medium"}
        >
          {name}
          {isCustom && (
            <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 text-[10px] dark:bg-white/10">
              {t("custom")}
            </span>
          )}
          {optimisticDone && completedAt && (
            <span className="ml-2 text-xs text-green-700 no-underline dark:text-green-400">
              {t("completedOn", { date: completedAt.slice(0, 10) })}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {!optimisticDone && (
            <button
              type="button"
              onClick={() => setShowPhoto((v) => !v)}
              className="flex min-h-11 items-center px-1 text-xs underline"
            >
              {t("addPhoto")}
            </button>
          )}
          <form action={handleComplete}>
            <input type="hidden" name="stage_id" value={stageId} />
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="done" value={optimisticDone ? "0" : "1"} />
            {!optimisticDone && showPhoto && (
              <div className="mb-2">
                <PhotoCapture projectId={projectId} month={month} />
              </div>
            )}
            <button
              className={
                optimisticDone
                  ? "flex min-h-11 items-center px-1 text-xs text-black/70 underline dark:text-white/70"
                  : "flex min-h-11 items-center rounded-lg border border-black/20 px-3 text-xs font-medium text-green-700 dark:border-white/25 dark:text-green-400"
              }
            >
              {optimisticDone ? t("undo") : t("markComplete")}
            </button>
          </form>
          {isCustom && (
            <form action={deleteBlockStage}>
              <input type="hidden" name="stage_id" value={stageId} />
              <input type="hidden" name="project_id" value={projectId} />
              <button
                aria-label={t("removeStage")}
                className="flex min-h-11 min-w-9 items-center justify-center text-red-600"
              >
                ✕
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
