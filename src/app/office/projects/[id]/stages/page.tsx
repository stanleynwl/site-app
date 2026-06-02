import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import {
  getProjectBlocks,
  withSignedStructurePhotos,
} from "@/lib/data/structure";
import { MarkSeen } from "@/components/mark-seen";
import { BlockBrowser, type BrowserBlock } from "@/components/block-browser";

// Office read-only view of ALL stages across blocks + stage photos. A block
// picker (chips + search) avoids scrolling through every block. Opening this
// page marks Stages as seen (clears the "New" badge on the project page).
export default async function OfficeStagesPage({
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

  const t = await getTranslations("Stages");

  return (
    <div className="space-y-4">
      <MarkSeen kind="stages" projectId={id} />
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
        <BlockBrowser
          searchPlaceholder={t("searchBlock")}
          blocks={blocks.map((b): BrowserBlock => {
            const done = b.stages.filter((s) => s.completed_at != null).length;
            return {
              id: b.id,
              name: b.name,
              subtitle: null,
              badge: b.stages.length > 0 ? `${done}/${b.stages.length}` : null,
              content: (
                <div className="space-y-2 rounded-xl border border-black/10 p-4 text-sm dark:border-white/15">
                  <p className="font-semibold">{b.name}</p>
                  {b.stages.length === 0 ? (
                    <p className="text-xs text-black/50 dark:text-white/50">
                      {t("noStages")}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {b.stages.map((s) => (
                        <span
                          key={s.id}
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            s.completed_at != null
                              ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                              : "bg-black/5 dark:bg-white/10"
                          }`}
                        >
                          {s.completed_at != null ? "✓ " : ""}
                          {s.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {b.stages.some((s) => s.photos.some((p) => p.url)) && (
                    <div className="flex flex-wrap gap-1">
                      {b.stages.flatMap((s) =>
                        s.photos.map((p) =>
                          p.url ? (
                            <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={p.url}
                                alt=""
                                className="h-16 w-16 rounded object-cover"
                              />
                            </a>
                          ) : null,
                        ),
                      )}
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
