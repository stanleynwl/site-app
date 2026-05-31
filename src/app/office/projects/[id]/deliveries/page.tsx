import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import {
  getProjectDeliveries,
  withDeliveryDownloadUrls,
  deliveryMaterialName,
  deliveryVariance,
} from "@/lib/data/deliveries";
import { getSuppliers, getMaterials } from "@/lib/data/catalog";
import {
  getProjectPurchaseRequests,
  itemName,
  PR_OPEN_STATUSES,
} from "@/lib/data/purchase-requests";
import { setDeliveryOfficeFields } from "@/lib/data/actions";
import { DeleteDeliveryButton } from "@/components/delete-delivery-button";
import { DeliveryPhotoDownloader } from "@/components/delivery-photo-downloader";

const inputCls =
  "rounded-lg border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

export default async function OfficeDeliveriesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const td = await getTranslations("Deliveries");

  const [rawDeliveries, suppliers, materials, requests] = await Promise.all([
    getProjectDeliveries(id),
    getSuppliers(),
    getMaterials(),
    getProjectPurchaseRequests(id),
  ]);
  const deliveries = await withDeliveryDownloadUrls(rawDeliveries);
  const openItems = requests
    .filter((r) => PR_OPEN_STATUSES.includes(r.status))
    .flatMap((r) => r.items.map((it) => ({ it })));

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/office/projects/${id}`}
          className="text-xs text-black/50 hover:underline dark:text-white/50"
        >
          ← {project.name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{td("title")}</h1>
      </div>

      {deliveries.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">{td("none")}</p>
      ) : (
        <ul className="space-y-3">
          {deliveries.map((d) => {
            const variance = deliveryVariance(d);
            return (
              <li
                key={d.id}
                className="space-y-2 rounded-xl border border-black/10 p-4 text-sm dark:border-white/15"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{deliveryMaterialName(d)}</span>
                  <span className="text-black/50 dark:text-white/50">
                    {d.delivered_on}
                  </span>
                </div>

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

                {/* Photos + download all/selected */}
                <DeliveryPhotoDownloader
                  photos={d.photos.map((p) => ({
                    id: p.id,
                    url: p.url ?? null,
                    downloadUrl: p.downloadUrl ?? null,
                  }))}
                />

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
    </div>
  );
}
