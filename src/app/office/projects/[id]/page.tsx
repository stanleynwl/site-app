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
  latestCompletedStage,
  latestProgressItem,
  hasNewStages,
  hasNewProgress,
} from "@/lib/data/structure";
import {
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
  const tpr = await getTranslations("Progress");
  const tp2 = await getTranslations("Projects");
  const tw = await getTranslations("Attendance");
  const tc = await getTranslations("Claims");

  const [reports, deliveries, stockSummary, blocks, refPhotos] =
    await Promise.all([
      getRecentReports(id, 6, { excludeSunday: true }),
      getProjectDeliveries(id),
      getStockSummary(id),
      getProjectBlocks(id),
      getProjectRefPhotos(id),
    ]);
  const month = todayISO().slice(0, 7);
  const deliveryPhotoCount = totalDeliveryPhotos(deliveries);

  // Progress / Stages summaries — only blocks with activity. "New" badge when
  // the site updated after the office's last-seen marker.
  const stageRows = blocks
    .map((b) => ({ block: b, stage: latestCompletedStage(b) }))
    .filter((r) => r.stage != null);
  const progressRows = blocks
    .map((b) => ({ block: b, item: latestProgressItem(b) }))
    .filter((r) => r.item != null);
  const stagesNew = blocks.some((b) => hasNewStages(b, project.stages_seen_at));
  const progressNew = blocks.some((b) =>
    hasNewProgress(b, project.progress_seen_at),
  );

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
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          <Link href={`/office/projects/${id}/activity`} className="underline">
            {t("activity")}
          </Link>
          <Link href={`/office/projects/${id}/attendance`} className="underline">
            {tw("title")}
          </Link>
          <Link href={`/office/projects/${id}/claims`} className="underline">
            {tc("title")}
          </Link>
        </div>
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

      {/* Progress summary — latest updated item per block with activity */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{tpr("title")}</h2>
            {progressNew && (
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white">
                {t("newBadge")}
              </span>
            )}
          </div>
          <div className="flex gap-3 text-xs">
            <Link href={`/office/projects/${id}/progress`} className="underline">
              {t("viewAll")}
            </Link>
            <Link href={`/office/projects/${id}/structure`} className="underline">
              {tsg("edit")}
            </Link>
          </div>
        </div>
        {progressRows.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{tpr("noItems")}</p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
            {progressRows.map(({ block, item }) => (
              <li key={block.id} className="px-4 py-2 text-sm">
                <span className="font-medium">{block.name}</span>
                <span className="mx-1 text-black/40">—</span>
                <span className="text-black/70 dark:text-white/70">
                  {item!.name ? `${item!.category} - ${item!.name}` : item!.category}{" "}
                  {item!.units_done}/{block.unit_count ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Stages summary — latest completed stage per block */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{tsg("title")}</h2>
            {stagesNew && (
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white">
                {t("newBadge")}
              </span>
            )}
          </div>
          <div className="flex gap-3 text-xs">
            <Link href={`/office/projects/${id}/stages`} className="underline">
              {t("viewAll")}
            </Link>
            <Link href={`/office/projects/${id}/structure`} className="underline">
              {tsg("edit")}
            </Link>
          </div>
        </div>
        {stageRows.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{tsg("noStages")}</p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
            {stageRows.map(({ block, stage }) => (
              <li key={block.id} className="px-4 py-2 text-sm">
                <span className="font-medium">{block.name}</span>
                <span className="mx-1 text-black/40">—</span>
                <span className="text-green-700 dark:text-green-400">
                  {tsg("completedSummary", { stage: stage!.name })}
                </span>
              </li>
            ))}
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
