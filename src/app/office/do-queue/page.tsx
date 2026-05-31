import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  getPendingDoDeliveries,
  withSignedUrls,
  deliveryMaterialName,
  type PendingDelivery,
} from "@/lib/data/deliveries";
import { getSuppliers, getMaterials } from "@/lib/data/catalog";
import {
  getOpenPurchaseRequests,
  itemName,
} from "@/lib/data/purchase-requests";
import { setDeliveryOfficeFields } from "@/lib/data/actions";

const inputCls =
  "rounded-lg border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

export default async function DoQueuePage() {
  const td = await getTranslations("Deliveries");

  const [rawPending, suppliers, materials, openRequests] = await Promise.all([
    getPendingDoDeliveries(),
    getSuppliers(),
    getMaterials(),
    getOpenPurchaseRequests(),
  ]);
  const pending = (await withSignedUrls(rawPending)) as PendingDelivery[];

  // Open request line items grouped by project, so a delivery can be linked to a
  // request from its own project (closes the three-quantity variance loop).
  const openItemsByProject = new Map<
    string,
    { id: string; label: string }[]
  >();
  for (const r of openRequests) {
    const list = openItemsByProject.get(r.project_id) ?? [];
    for (const it of r.items) {
      list.push({
        id: it.id,
        label: `${itemName(it)}${it.quantity != null ? ` (${it.quantity})` : ""}`,
      });
    }
    openItemsByProject.set(r.project_id, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{td("queueTitle")}</h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          {td("queueHint")}
        </p>
      </div>

      {pending.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">
          {td("queueEmpty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {pending.map((d) => {
            const openItems = openItemsByProject.get(d.project_id) ?? [];
            return (
              <li
                key={d.id}
                className="space-y-2 rounded-xl border border-black/10 p-4 text-sm dark:border-white/15"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-medium">{deliveryMaterialName(d)}</span>
                    <div className="text-xs text-black/50 dark:text-white/50">
                      <Link
                        href={`/office/projects/${d.project_id}`}
                        className="underline"
                      >
                        {d.project?.name ?? "—"}
                      </Link>
                      {d.delivered_on ? ` · ${td("loggedOn", { date: d.delivered_on })}` : ""}
                      {d.do_number ? ` · DO ${d.do_number}` : ""}
                    </div>
                  </div>
                </div>

                {d.photos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {d.photos.map((p) =>
                      p.url ? (
                        <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.url}
                            alt=""
                            className="h-20 w-20 rounded-lg object-cover"
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

                {/* Office fills supplier/material + DO quantity from the photo */}
                <form
                  action={setDeliveryOfficeFields}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input type="hidden" name="delivery_id" value={d.id} />
                  <input type="hidden" name="project_id" value={d.project_id} />
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
                      {openItems.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.label}
                        </option>
                      ))}
                    </select>
                  )}
                  <button className="rounded-lg border border-black/20 px-3 py-1 text-xs font-medium dark:border-white/25">
                    {td("save")}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
