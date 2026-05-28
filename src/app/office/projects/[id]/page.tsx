import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { getProjectReports } from "@/lib/data/reports";
import {
  getProjectDeliveries,
  withSignedUrls,
  deliveryMaterialName,
  deliveryVariance,
} from "@/lib/data/deliveries";
import { getSuppliers, getMaterials } from "@/lib/data/catalog";
import { getProjectTags, TAG_KINDS } from "@/lib/data/tags";
import { getProjectPhotos, withSignedPhotoUrls } from "@/lib/data/photos";
import {
  getProjectPurchaseRequests,
  itemName,
  PR_OPEN_STATUSES,
} from "@/lib/data/purchase-requests";
import { getStockSummary } from "@/lib/data/stock";
import {
  setDeliveryOfficeFields,
  createProjectTag,
  approveProjectTag,
  deleteProjectTag,
  setPhotoTags,
} from "@/lib/data/actions";
import { DeleteDeliveryButton } from "@/components/delete-delivery-button";

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
  const tp = await getTranslations("Photos");
  const tk = await getTranslations("Tags");
  const tst = await getTranslations("Stock");
  const [
    reports,
    rawDeliveries,
    suppliers,
    materials,
    tags,
    rawPhotos,
    requests,
    stockSummary,
  ] = await Promise.all([
    getProjectReports(id),
    getProjectDeliveries(id),
    getSuppliers(),
    getMaterials(),
    getProjectTags(id),
    getProjectPhotos(id),
    getProjectPurchaseRequests(id),
    getStockSummary(id),
  ]);
  const deliveries = await withSignedUrls(rawDeliveries);
  const photos = await withSignedPhotoUrls(rawPhotos);
  const approvedTags = tags.filter((tg) => tg.approved);
  const pendingTags = tags.filter((tg) => !tg.approved);
  // Open request line items a delivery can be linked to (closes the variance loop).
  const openItems = requests
    .filter((r) => PR_OPEN_STATUSES.includes(r.status))
    .flatMap((r) => r.items.map((it) => ({ it, request: r })));
  const inputCls =
    "rounded-lg border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

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
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold">{t("timeline")}</h2>
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

      <section>
        <h2 className="mb-2 text-sm font-semibold">{td("title")}</h2>
        {deliveries.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{td("none")}</p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
            {deliveries.map((d) => {
              const variance = deliveryVariance(d);
              return (
                <li key={d.id} className="space-y-2 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{deliveryMaterialName(d)}</span>
                    <span className="text-black/50 dark:text-white/50">
                      {d.delivered_on}
                    </span>
                  </div>

                  {/* Photos (signed URLs) */}
                  {d.photos.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {d.photos.map((p) =>
                        p.url ? (
                          <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={p.url}
                              alt=""
                              className="h-16 w-16 rounded-lg object-cover"
                            />
                          </a>
                        ) : null,
                      )}
                    </div>
                  )}

                  {d.issue_type && (
                    <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                      {td(`issueType.${d.issue_type}`)}
                      {d.note ? `: ${d.note}` : ""}
                    </span>
                  )}

                  <div className="text-black/60 dark:text-white/60">
                    {d.do_number ? `DO ${d.do_number}` : ""}
                    {d.requested_quantity != null
                      ? ` · ${td("requested")}: ${d.requested_quantity}`
                      : ""}
                    {d.received_quantity != null
                      ? ` · ${td("received")}: ${d.received_quantity}${d.unit ? ` ${d.unit}` : ""}`
                      : ""}
                    {variance != null ? ` · ${td("variance")}: ${variance}` : ""}
                  </div>

                  {/* Office fills supplier/material + DO quantity from the photo */}
                  <form
                    action={setDeliveryOfficeFields}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="delivery_id" value={d.id} />
                    <input type="hidden" name="project_id" value={id} />
                    <select name="supplier_id" defaultValue="" className={inputCls}>
                      <option value="">{td("supplier")}</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <select name="material_id" defaultValue="" className={inputCls}>
                      <option value="">{td("material")}</option>
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      name="do_quantity"
                      min="0"
                      step="0.001"
                      defaultValue={d.do_quantity ?? ""}
                      placeholder={td("doQuantity")}
                      className={`${inputCls} w-24`}
                    />
                    {openItems.length > 0 && (
                      <select
                        name="purchase_request_item_id"
                        defaultValue=""
                        className={inputCls}
                      >
                        <option value="">{td("linkRequest")}</option>
                        {openItems.map(({ it }) => (
                          <option key={it.id} value={it.id}>
                            {itemName(it)}
                            {it.quantity != null ? ` (${it.quantity})` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                    <button className="rounded-lg border border-black/20 px-3 py-1 text-xs font-medium dark:border-white/25">
                      {td("save")}
                    </button>
                  </form>

                  <DeleteDeliveryButton deliveryId={d.id} projectId={id} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Photo tags (taxonomy management) -------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{tk("title")}</h2>

        <form
          action={createProjectTag}
          className="flex flex-wrap items-end gap-2 rounded-xl border border-black/10 p-4 text-sm dark:border-white/15"
        >
          <input type="hidden" name="project_id" value={id} />
          <span className="w-full font-semibold">{tk("newTag")}</span>
          <select name="kind" defaultValue="block" className={inputCls}>
            {TAG_KINDS.map((k) => (
              <option key={k} value={k}>
                {tk(`kindOpt.${k}`)}
              </option>
            ))}
          </select>
          <input
            name="label"
            required
            placeholder={tk("label")}
            className={inputCls}
          />
          <button className="rounded-lg border border-black/20 px-3 py-1 text-xs font-medium dark:border-white/25">
            {tk("addTag")}
          </button>
        </form>

        {pendingTags.length > 0 && (
          <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700/50 dark:bg-amber-950/30">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              {tk("pending")}
            </p>
            <ul className="flex flex-wrap gap-2">
              {pendingTags.map((tg) => (
                <li
                  key={tg.id}
                  className="flex items-center gap-1 rounded-full border border-amber-400 bg-white px-2 py-0.5 text-xs dark:bg-black/20"
                >
                  <span className="text-black/50 dark:text-white/50">
                    {tk(`kindOpt.${tg.kind}`)}:
                  </span>
                  <span>{tg.label}</span>
                  <form action={approveProjectTag} className="inline">
                    <input type="hidden" name="tag_id" value={tg.id} />
                    <input type="hidden" name="project_id" value={id} />
                    <button className="ml-1 text-green-700 underline dark:text-green-400">
                      {tk("approve")}
                    </button>
                  </form>
                  <form action={deleteProjectTag} className="inline">
                    <input type="hidden" name="tag_id" value={tg.id} />
                    <input type="hidden" name="project_id" value={id} />
                    <button className="text-red-600 underline">✕</button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}

        {approvedTags.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{tk("none")}</p>
        ) : (
          <div className="space-y-2">
            {TAG_KINDS.map((kind) => {
              const ofKind = approvedTags.filter((tg) => tg.kind === kind);
              if (ofKind.length === 0) return null;
              return (
                <div key={kind} className="text-sm">
                  <span className="text-xs text-black/50 dark:text-white/50">
                    {tk(`kindOpt.${kind}`)}
                  </span>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {ofKind.map((tg) => (
                      <li
                        key={tg.id}
                        className="flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10"
                      >
                        <span>{tg.label}</span>
                        <form action={deleteProjectTag} className="inline">
                          <input type="hidden" name="tag_id" value={tg.id} />
                          <input type="hidden" name="project_id" value={id} />
                          <button
                            aria-label={tk("delete")}
                            className="text-red-600"
                          >
                            ✕
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Progress photos (gallery + tag editing) ------------------------ */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{tp("title")}</h2>
        {photos.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{tp("none")}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {photos.map((p) => (
              <li
                key={p.id}
                className="space-y-2 rounded-xl border border-black/10 p-3 dark:border-white/15"
              >
                <div className="flex gap-3">
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt={p.caption ?? ""}
                        className="h-20 w-20 rounded-lg object-cover"
                      />
                    </a>
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-black/5 text-[10px] text-black/40 dark:bg-white/10 dark:text-white/40">
                      {tp("archived")}
                    </div>
                  )}
                  <div className="flex-1 text-sm">
                    {p.caption && <p>{p.caption}</p>}
                    <p className="text-xs text-black/50 dark:text-white/50">
                      {p.taken_at?.slice(0, 10) ?? p.created_at.slice(0, 10)}
                    </p>
                  </div>
                </div>

                {/* Edit tags */}
                {approvedTags.length > 0 && (
                  <form action={setPhotoTags} className="space-y-2">
                    <input type="hidden" name="photo_id" value={p.id} />
                    <input type="hidden" name="project_id" value={id} />
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {approvedTags.map((tg) => (
                        <label
                          key={tg.id}
                          className="flex items-center gap-1 text-xs"
                        >
                          <input
                            type="checkbox"
                            name="tag_id"
                            value={tg.id}
                            defaultChecked={p.tags.some((x) => x.id === tg.id)}
                            className="h-3.5 w-3.5"
                          />
                          <span>
                            <span className="text-black/40 dark:text-white/40">
                              {tk(`kindOpt.${tg.kind}`)}:
                            </span>{" "}
                            {tg.label}
                          </span>
                        </label>
                      ))}
                    </div>
                    <button className="rounded-lg border border-black/20 px-3 py-1 text-xs font-medium dark:border-white/25">
                      {tk("save")}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Stock on site (latest count + derived consumption) ------------- */}
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
    </div>
  );
}
