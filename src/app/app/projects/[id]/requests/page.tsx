import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { getMaterials } from "@/lib/data/catalog";
import {
  getProjectPurchaseRequests,
  itemName,
  withSignedRequestPhotos,
  isVisibleToSite,
} from "@/lib/data/purchase-requests";
import {
  confirmDeliveredPurchaseRequest,
  updateRequestItemQuantity,
} from "@/lib/data/actions";
import { todayISO } from "@/lib/date";
import { PurchaseRequestForm } from "@/components/purchase-request-form";

export default async function ProjectRequestsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const t = await getTranslations("Requests");
  const [materials, allRequests] = await Promise.all([
    getMaterials(),
    getProjectPurchaseRequests(id),
  ]);
  const requests = await withSignedRequestPhotos(
    allRequests.filter(isVisibleToSite),
  );

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/app/projects/${id}`}
          className="text-xs text-black/50 hover:underline dark:text-white/50"
        >
          ← {project.name}
        </Link>
        <h1 className="mt-1 text-lg font-semibold">{t("title")}</h1>
      </div>

      <PurchaseRequestForm
        projectId={id}
        today={todayISO()}
        materials={materials.filter((m) => m.active)}
      />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("recent")}</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{t("none")}</p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
            {requests.map((r) => (
              <li key={r.id} className="space-y-1 px-4 py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <ul className="flex-1 space-y-1">
                    {r.items.map((it) => (
                      <li key={it.id} className="flex items-center gap-2">
                        <span className="flex-1 font-medium">{itemName(it)}</span>
                        <form
                          action={updateRequestItemQuantity}
                          className="flex items-center gap-1"
                        >
                          <input type="hidden" name="item_id" value={it.id} />
                          <input type="hidden" name="project_id" value={id} />
                          <input
                            name="quantity"
                            type="number"
                            step="any"
                            min="0"
                            defaultValue={it.quantity ?? ""}
                            aria-label={t("quantity")}
                            className="w-20 rounded-lg border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
                          />
                          {it.unit && (
                            <span className="text-xs text-black/50 dark:text-white/50">
                              {it.unit}
                            </span>
                          )}
                          <button className="rounded-lg border border-black/20 px-2 py-1 text-xs font-medium dark:border-white/25">
                            {t("saveQty")}
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                  <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                    {t(`status.${r.status}`)}
                  </span>
                </div>
                {r.photos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {r.photos.map((p) =>
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
                <div className="text-black/60 dark:text-white/60">
                  {r.needed_by ? `${t("neededBy")}: ${r.needed_by}` : ""}
                  {r.po_number ? ` · PO ${r.po_number}` : ""}
                </div>
                {r.urgency_reason && (
                  <p className="text-black/50 dark:text-white/50">
                    {r.urgency_reason}
                  </p>
                )}
                {r.status === "po_issued" && (
                  <form action={confirmDeliveredPurchaseRequest}>
                    <input type="hidden" name="request_id" value={r.id} />
                    <input type="hidden" name="project_id" value={id} />
                    <button className="rounded-lg border border-black/20 px-3 py-1 text-xs font-medium dark:border-white/25">
                      {t("confirmDelivered")}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
