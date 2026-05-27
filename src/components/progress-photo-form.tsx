"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { createPhoto, type PhotoState } from "@/lib/data/actions";
import { PhotoCapture } from "@/components/photo-capture";
import { TAG_KINDS, type ProjectTag } from "@/lib/data/tag-kinds";

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

export function ProgressPhotoForm({
  projectId,
  today,
  tags,
}: {
  projectId: string;
  today: string;
  tags: ProjectTag[]; // approved tags only
}) {
  const t = useTranslations("Photos");
  const tk = useTranslations("Tags");
  const month = today.slice(0, 7); // YYYY-MM
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, action, pending] = useActionState<PhotoState, FormData>(
    createPhoto,
    undefined,
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="tag_id" value={id} />
      ))}
      <p className="text-sm font-semibold">{t("newPhoto")}</p>

      <PhotoCapture projectId={projectId} month={month} />

      <label className="block text-sm">
        <span className="mb-1 block">{t("caption")}</span>
        <input name="caption" placeholder={t("captionHint")} className={inputClass} />
      </label>

      {/* Tag chips, grouped by kind (approved tags only) */}
      {tags.length > 0 && (
        <div className="space-y-2">
          <span className="block text-sm font-medium">{tk("title")}</span>
          {TAG_KINDS.map((kind) => {
            const ofKind = tags.filter((tg) => tg.kind === kind);
            if (ofKind.length === 0) return null;
            return (
              <div key={kind} className="space-y-1">
                <span className="text-xs text-black/50 dark:text-white/50">
                  {tk(`kindOpt.${kind}`)}
                </span>
                <div className="flex flex-wrap gap-2">
                  {ofKind.map((tg) => {
                    const on = selected.has(tg.id);
                    return (
                      <button
                        key={tg.id}
                        type="button"
                        onClick={() => toggle(tg.id)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          on
                            ? "border-foreground bg-foreground text-background"
                            : "border-black/20 dark:border-white/25"
                        }`}
                      >
                        {tg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
        {pending ? t("saving") : t("add")}
      </button>
    </form>
  );
}
