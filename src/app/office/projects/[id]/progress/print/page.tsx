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
import { todayISO } from "@/lib/date";
import { PrintButton } from "@/components/print-button";

// Print-optimized progress report → browser "Save as PDF". One section per block
// with its category items (units done / total), overall %, and progress photos.
// Only blocks that have at least one started item are included, to keep the
// printout to what actually has progress.
export default async function ProgressPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ photos?: string }>;
}) {
  const { id } = await params;
  const { photos: photosParam } = await searchParams;
  const withPhotos = photosParam !== "0"; // default on; ?photos=0 hides them
  const [project, rawBlocks] = await Promise.all([
    getProject(id),
    getProjectBlocks(id),
  ]);
  if (!project) notFound();
  const blocks = withPhotos
    ? await withSignedStructurePhotos(rawBlocks)
    : rawBlocks;

  const t = await getTranslations("Progress");
  const tp = await getTranslations("Pdf");

  // Keep only blocks with some progress (any started item), newest progress first.
  const active = blocks.filter((b) =>
    b.progress_items.some((p) => p.units_done > 0),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 text-black">
      <div className="no-print flex items-center justify-between">
        <Link
          href={`/office/projects/${id}/progress`}
          className="text-sm text-black/50 underline dark:text-white/60"
        >
          ← {t("title")}
        </Link>
        <PrintButton />
      </div>

      <article className="space-y-5 rounded-lg border border-black/15 bg-white p-8 text-sm leading-relaxed text-black print:border-0 print:p-0">
        <header className="border-b border-black/20 pb-3">
          <h1 className="text-lg font-bold">{project.name}</h1>
          <p className="text-black/60">
            {[project.code, project.location].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-2 font-semibold">{t("reportTitle")}</p>
        </header>

        {active.length === 0 ? (
          <p className="text-black/60">{t("noItems")}</p>
        ) : (
          active.map((b) => {
            const pct = blockProgressPercent(b);
            return (
              <section key={b.id} className="space-y-2 break-inside-avoid">
                <h2 className="flex items-baseline justify-between border-b border-black/10 pb-1 font-semibold">
                  <span>
                    {b.name}
                    {b.unit_count != null && (
                      <span className="ml-2 text-xs font-normal text-black/60">
                        {t("units", { count: b.unit_count })}
                      </span>
                    )}
                  </span>
                  {pct != null && <span className="text-sm">{pct}%</span>}
                </h2>

                {groupProgressByCategory(
                  b.progress_items.filter((p) => p.units_done > 0),
                ).map((grp) => (
                  <div key={grp.category} className="space-y-1">
                    <p className="text-xs font-semibold text-black/70">
                      {grp.category}
                    </p>
                    <ul className="space-y-0.5 pl-2">
                      {grp.items.map((p) => {
                        const cap = b.unit_count ?? 0;
                        const complete = cap > 0 && p.units_done >= cap;
                        return (
                          <li
                            key={p.id}
                            className="flex items-baseline justify-between gap-2 text-xs"
                          >
                            <span>
                              {p.name ? `${p.category} - ${p.name}` : p.category}
                              {complete ? " ✓" : ""}
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {p.units_done} / {b.unit_count ?? "—"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>

                    {withPhotos && (
                      <div className="flex flex-wrap gap-1.5">
                        {grp.items.flatMap((p) =>
                          p.photos
                            .filter((ph) => ph.url)
                            .map((ph) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={ph.id}
                                src={ph.url!}
                                alt=""
                                className="h-24 w-24 rounded border border-black/15 object-cover"
                              />
                            )),
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </section>
            );
          })
        )}

        <footer className="border-t border-black/20 pt-3 text-xs text-black/50">
          {tp("generated", { date: todayISO() })}
        </footer>
      </article>
    </div>
  );
}
