import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import {
  getProjectBlocks,
  withSignedStructurePhotos,
  groupProgressByCategory,
  blockProgressPercent,
} from "@/lib/data/structure";
import { MarkSeen } from "@/components/mark-seen";

// Office read-only view of ALL progress (A–L items, units done/total, photos)
// across blocks. Opening this page marks Progress as seen.
export default async function OfficeProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, rawBlocks] = await Promise.all([
    getProject(id),
    getProjectBlocks(id),
  ]);
  if (!project) notFound();
  const blocks = await withSignedStructurePhotos(rawBlocks);

  const t = await getTranslations("Progress");

  return (
    <div className="space-y-4">
      <MarkSeen kind="progress" projectId={id} />
      <div>
        <Link
          href={`/office/projects/${id}`}
          className="text-xs text-black/50 hover:underline dark:text-white/50"
        >
          ← {project.name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{t("title")}</h1>
      </div>

      {blocks.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">{t("noBlocks")}</p>
      ) : (
        <ul className="space-y-3">
          {blocks.map((b) => {
            const pct = blockProgressPercent(b);
            return (
              <li
                key={b.id}
                className="space-y-2 rounded-xl border border-black/10 p-4 text-sm dark:border-white/15"
              >
                <p className="font-semibold">
                  {b.name}
                  {b.unit_count != null && (
                    <span className="ml-2 text-xs font-normal text-black/50 dark:text-white/50">
                      {t("units", { count: b.unit_count })}
                    </span>
                  )}
                  {pct != null && (
                    <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                      {pct}%
                    </span>
                  )}
                </p>
                {b.progress_items.length === 0 ? (
                  <p className="text-xs text-black/50 dark:text-white/50">
                    {t("noItems")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {groupProgressByCategory(b.progress_items).map((grp) => (
                      <div key={grp.category}>
                        <p className="text-xs font-semibold text-black/60 dark:text-white/60">
                          {grp.category}
                        </p>
                        <ul className="mt-1 space-y-1">
                          {grp.items.map((p) => (
                            <li key={p.id} className="text-xs">
                              <div>
                                <span className="text-black/60 dark:text-white/60">
                                  {p.name ? `${p.category} - ${p.name}` : p.category}
                                </span>
                                <span className="ml-2 font-medium">
                                  {p.units_done} / {b.unit_count ?? "—"}
                                </span>
                              </div>
                              {p.photos.some((ph) => ph.url) && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {p.photos.map((ph) =>
                                    ph.url ? (
                                      <a key={ph.id} href={ph.url} target="_blank" rel="noreferrer">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={ph.url}
                                          alt=""
                                          className="h-16 w-16 rounded object-cover"
                                        />
                                      </a>
                                    ) : null,
                                  )}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
