import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { getRecentReports } from "@/lib/data/reports";
import {
  getProjectDeliveries,
  totalDeliveryPhotos,
} from "@/lib/data/deliveries";
import { getStockSummary } from "@/lib/data/stock";
import {
  getProjectBlocks,
  getProjectRefPhotos,
  withSignedStructurePhotos,
  blockProgressPercent,
} from "@/lib/data/structure";
import {
  createProjectBlock,
  updateProjectBlock,
  deleteProjectBlock,
  addBlockStage,
  deleteBlockStage,
  addProjectRefPhoto,
  deleteProjectRefPhoto,
  updateProjectName,
} from "@/lib/data/actions";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { PhotoCapture } from "@/components/photo-capture";
import { todayISO } from "@/lib/date";

const inputCls =
  "rounded-lg border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";
const btnCls =
  "rounded-lg border border-black/20 px-3 py-1 text-xs font-medium dark:border-white/25";

export default async function OfficeProjectDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const t = await getTranslations("Office");
  const ts = await getTranslations("Status");
  const tr = await getTranslations("Report");
  const td = await getTranslations("Deliveries");
  const tst = await getTranslations("Stock");
  const tsg = await getTranslations("Stages");
  const tp2 = await getTranslations("Projects");

  const [reports, deliveries, stockSummary, rawBlocks, refPhotos] =
    await Promise.all([
      getRecentReports(id, 6, { excludeSunday: true }),
      getProjectDeliveries(id),
      getStockSummary(id),
      getProjectBlocks(id),
      getProjectRefPhotos(id),
    ]);
  const blocks = await withSignedStructurePhotos(rawBlocks);
  const month = todayISO().slice(0, 7);
  const deliveryPhotoCount = totalDeliveryPhotos(deliveries);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/office/projects"
          className="text-xs text-black/50 hover:underline dark:text-white/50"
        >
          ← {t("backToProjects")}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{project.name}</h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          {[project.code, project.location].filter(Boolean).join(" · ")}
        </p>
        <form action={updateProjectName} className="mt-2 flex items-center gap-2">
          <input type="hidden" name="project_id" value={id} />
          <input
            name="name"
            defaultValue={project.name}
            required
            aria-label={tp2("editName")}
            className={`${inputCls} w-64`}
          />
          <button className={btnCls}>{tp2("rename")}</button>
        </form>
      </div>

      {/* Report timeline — recent working days (excludes Sunday) + View all */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("timeline")}</h2>
          <Link
            href={`/office/projects/${id}/reports`}
            className="text-xs underline"
          >
            {t("viewAll")}
          </Link>
        </div>
        {reports.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            {t("noReports")}
          </p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
            {reports.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="text-sm">
                  <span className="font-medium">{r.report_date}</span>
                  <span className="ml-2 text-black/50 dark:text-white/50">
                    {ts(r.status)}
                    {r.is_backdated ? ` · ${tr("backdatedBadge")}` : ""}
                    {r.weather ? ` · ${tr(`weatherOpt.${r.weather}`)}` : ""}
                  </span>
                </div>
                <Link
                  href={`/office/projects/${id}/reports/${r.id}`}
                  className="text-sm underline"
                >
                  {t("view")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Deliveries — summary + link to the detail/download page */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">{td("title")}</h2>
        <Link
          href={`/office/projects/${id}/deliveries`}
          className="flex items-center justify-between rounded-xl border border-black/10 px-4 py-3 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
        >
          <span>
            {deliveries.length === 0
              ? td("none")
              : td("summary", {
                  deliveries: deliveries.length,
                  photos: deliveryPhotoCount,
                })}
          </span>
          <span className="shrink-0 underline">{td("viewDeliveries")}</span>
        </Link>
      </section>

      {/* Stock on site (latest count + derived consumption) */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{tst("onHand")}</h2>
        {stockSummary.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{tst("none")}</p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
            {stockSummary.map((s) => (
              <li key={s.material_id} className="space-y-1 px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{s.material_name}</span>
                  <span>
                    {s.latest_qty}
                    {s.unit ? ` ${s.unit}` : ""}
                  </span>
                </div>
                <div className="text-xs text-black/50 dark:text-white/50">
                  {tst("countedOn", { date: s.latest_date })}
                  {s.consumption != null
                    ? ` · ${tst("consumedSince", { qty: s.consumption, date: s.previous_date ?? "" })}`
                    : ` · ${tst("firstCount")}`}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Project reference photos (shown atop site Progress/Stages) */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{tsg("refPhotos")}</h2>
        <p className="text-xs text-black/50 dark:text-white/50">
          {tsg("refPhotosHint")}
        </p>
        {refPhotos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {refPhotos.map((p) =>
              p.url ? (
                <div key={p.id} className="relative">
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt=""
                      className="h-24 w-24 rounded-lg object-cover"
                    />
                  </a>
                  <form
                    action={deleteProjectRefPhoto}
                    className="absolute -right-2 -top-2"
                  >
                    <input type="hidden" name="photo_id" value={p.id} />
                    <input type="hidden" name="project_id" value={id} />
                    <button
                      aria-label={tsg("removeStage")}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white"
                    >
                      ✕
                    </button>
                  </form>
                </div>
              ) : null,
            )}
          </div>
        )}
        <form action={addProjectRefPhoto} className="flex items-end gap-2">
          <input type="hidden" name="project_id" value={id} />
          <PhotoCapture projectId={id} month={month} />
          <button className={btnCls}>{tsg("saveRefPhoto")}</button>
        </form>
      </section>

      {/* Project structure: read-only status, with Edit disclosures */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">{tsg("officeTitle")}</h2>
          <p className="text-xs text-black/50 dark:text-white/50">
            {tsg("officeIntro")}
          </p>
        </div>

        {/* Add a block (edit-only) */}
        <details className="rounded-xl border border-black/10 dark:border-white/15">
          <summary className="cursor-pointer px-4 py-2 text-sm font-medium">
            + {tsg("newBlock")}
          </summary>
          <form
            action={createProjectBlock}
            className="flex flex-wrap items-end gap-2 px-4 pb-4 text-sm"
          >
            <input type="hidden" name="project_id" value={id} />
            <input
              name="name"
              required
              placeholder={tsg("blockNameHint")}
              className={inputCls}
            />
            <input name="unit_from" placeholder={tsg("unitFrom")} className={inputCls} />
            <input name="unit_to" placeholder={tsg("unitTo")} className={inputCls} />
            <input
              name="unit_count"
              type="number"
              min="0"
              placeholder={tsg("unitCount")}
              className={`${inputCls} w-28`}
            />
            <button className={btnCls}>{tsg("addBlock")}</button>
          </form>
        </details>

        {blocks.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            {tsg("noBlocks")}
          </p>
        ) : (
          <ul className="space-y-3">
            {blocks.map((b) => {
              const pct = blockProgressPercent(b);
              const startedItems = b.progress_items.filter((p) => p.units_done > 0);
              return (
                <li
                  key={b.id}
                  className="space-y-3 rounded-xl border border-black/10 p-4 text-sm dark:border-white/15"
                >
                  {/* Read-only header */}
                  <div>
                    <p className="font-semibold">
                      {b.name}
                      {b.unit_count != null && (
                        <span className="ml-2 text-xs font-normal text-black/50 dark:text-white/50">
                          {tsg("units", { count: b.unit_count })}
                        </span>
                      )}
                      {pct != null && (
                        <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                          {pct}%
                        </span>
                      )}
                    </p>
                    {(b.unit_from || b.unit_to) && (
                      <p className="text-xs text-black/50 dark:text-white/50">
                        {tsg("unitRange", {
                          from: b.unit_from ?? "—",
                          to: b.unit_to ?? "—",
                        })}
                      </p>
                    )}
                  </div>

                  {/* Read-only stages */}
                  {b.stages.length > 0 && (
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

                  {/* Read-only progress rollup (items with any units done) */}
                  {startedItems.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-black/60 dark:text-white/60">
                        {tsg("progressRollup")}
                      </p>
                      <ul className="mt-1 space-y-1">
                        {startedItems.map((p) => (
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
                                        className="h-14 w-14 rounded object-cover"
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
                  )}

                  {/* Stage photos (read-only) */}
                  {b.stages.some((s) => s.photos.some((ph) => ph.url)) && (
                    <div className="flex flex-wrap gap-1">
                      {b.stages.flatMap((s) =>
                        s.photos.map((ph) =>
                          ph.url ? (
                            <a key={ph.id} href={ph.url} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={ph.url}
                                alt=""
                                className="h-14 w-14 rounded object-cover"
                              />
                            </a>
                          ) : null,
                        ),
                      )}
                    </div>
                  )}

                  {/* Edit controls (disclosure) */}
                  <details className="rounded-lg border border-black/10 dark:border-white/15">
                    <summary className="cursor-pointer px-3 py-1.5 text-xs font-medium">
                      {tsg("edit")}
                    </summary>
                    <div className="space-y-2 px-3 pb-3">
                      <form
                        action={updateProjectBlock}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <input type="hidden" name="block_id" value={b.id} />
                        <input type="hidden" name="project_id" value={id} />
                        <input
                          name="name"
                          required
                          defaultValue={b.name}
                          placeholder={tsg("blockName")}
                          className={inputCls}
                        />
                        <input
                          name="unit_from"
                          defaultValue={b.unit_from ?? ""}
                          placeholder={tsg("unitFrom")}
                          className={inputCls}
                        />
                        <input
                          name="unit_to"
                          defaultValue={b.unit_to ?? ""}
                          placeholder={tsg("unitTo")}
                          className={inputCls}
                        />
                        <input
                          name="unit_count"
                          type="number"
                          min="0"
                          defaultValue={b.unit_count ?? ""}
                          placeholder={tsg("unitCount")}
                          className={`${inputCls} w-28`}
                        />
                        <button className={btnCls}>{tsg("saveBlock")}</button>
                      </form>

                      {b.stages.length > 0 && (
                        <ul className="flex flex-wrap gap-2">
                          {b.stages.map((s) => (
                            <li
                              key={s.id}
                              className="flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10"
                            >
                              <span>{s.name}</span>
                              <form action={deleteBlockStage} className="inline">
                                <input type="hidden" name="stage_id" value={s.id} />
                                <input type="hidden" name="project_id" value={id} />
                                <button
                                  aria-label={tsg("removeStage")}
                                  className="text-red-600"
                                >
                                  ✕
                                </button>
                              </form>
                            </li>
                          ))}
                        </ul>
                      )}

                      <form action={addBlockStage} className="flex items-end gap-2">
                        <input type="hidden" name="block_id" value={b.id} />
                        <input type="hidden" name="project_id" value={id} />
                        <input
                          name="name"
                          required
                          placeholder={tsg("stageName")}
                          className={`${inputCls} flex-1`}
                        />
                        <button className={btnCls}>{tsg("addStage")}</button>
                      </form>

                      <form action={deleteProjectBlock}>
                        <input type="hidden" name="block_id" value={b.id} />
                        <input type="hidden" name="project_id" value={id} />
                        <button className="text-xs text-red-600 underline">
                          {tsg("deleteBlock")}
                        </button>
                      </form>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Danger zone: permanent project delete */}
      <section className="space-y-2 rounded-xl border border-red-300 p-4 dark:border-red-800/60">
        <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">
          {tp2("danger")}
        </h2>
        <p className="text-xs text-black/50 dark:text-white/50">
          {tp2("deleteHint")}
        </p>
        <DeleteProjectButton projectId={id} projectName={project.name} />
      </section>
    </div>
  );
}
