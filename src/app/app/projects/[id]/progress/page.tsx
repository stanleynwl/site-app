import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import {
  getProjectBlocks,
  getProjectRefPhotos,
  withSignedStructurePhotos,
  groupProgressByCategory,
  blockProgressPercent,
} from "@/lib/data/structure";
import { RefPhotoStrip } from "@/components/ref-photo-strip";
import { progressItemLabel } from "@/lib/progress-template";
import { todayISO } from "@/lib/date";
import { ProgressItemRow } from "@/components/progress-item-row";
import { BlockBrowser, type BrowserBlock } from "@/components/block-browser";

export default async function ProjectProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const t = await getTranslations("Progress");
  const [rawBlocks, refPhotos] = await Promise.all([
    getProjectBlocks(id),
    getProjectRefPhotos(id),
  ]);
  // Sign photo URLs so the supervisor sees the photos already saved per item
  // (confirms the capture persisted — they were previously invisible on site).
  const blocks = await withSignedStructurePhotos(rawBlocks);
  const month = todayISO().slice(0, 7);

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/app/projects/${id}`}
          className="text-xs text-black/70 hover:underline dark:text-white/70"
        >
          ← {project.name}
        </Link>
        <h1 className="mt-1 text-lg font-semibold">{t("title")}</h1>
        <p className="text-sm text-black/70 dark:text-white/70">{t("intro")}</p>
      </div>

      <RefPhotoStrip photos={refPhotos} />

      {blocks.length === 0 ? (
        <p className="text-sm text-black/70 dark:text-white/70">{t("noBlocks")}</p>
      ) : (
        <BlockBrowser
          searchPlaceholder={t("searchBlock")}
          blocks={blocks.map((b): BrowserBlock => {
            const pct = blockProgressPercent(b);
            const subtitle =
              (b.unit_from || b.unit_to)
                ? `${b.unit_from ?? "—"} → ${b.unit_to ?? "—"}`
                : null;
            return {
              id: b.id,
              name: b.name,
              subtitle,
              badge: pct != null ? `${pct}%` : null,
              content: (
                <div className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/15">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{b.name}</p>
                      <p className="text-xs text-black/70 dark:text-white/70">
                        {t("units", { count: b.unit_count ?? 0 })}
                        {subtitle ? ` · ${subtitle}` : ""}
                      </p>
                    </div>
                    {pct != null && (
                      <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                        {pct}%
                      </span>
                    )}
                  </div>

                  {b.progress_items.length === 0 ? (
                    <p className="text-sm text-black/70 dark:text-white/70">
                      {t("noItems")}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {groupProgressByCategory(b.progress_items).map((grp) => (
                        <div key={grp.category}>
                          <p className="text-xs font-semibold text-black/60 dark:text-white/60">
                            {grp.category}
                          </p>
                          <ul className="divide-y divide-black/10 dark:divide-white/10">
                            {grp.items.map((it) => (
                              <li key={it.id}>
                                <ProgressItemRow
                                  itemId={it.id}
                                  projectId={id}
                                  label={
                                    it.name ??
                                    progressItemLabel(it.category, it.name)
                                  }
                                  unitsDone={it.units_done}
                                  unitCount={b.unit_count}
                                  month={month}
                                  photos={it.photos}
                                />
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ),
            };
          })}
        />
      )}
    </div>
  );
}
