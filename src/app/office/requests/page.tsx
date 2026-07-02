import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  getOpenPurchaseRequests,
  itemName,
  prAgeHours,
  withSignedRequestPhotos,
} from "@/lib/data/purchase-requests";
import { getSuppliers } from "@/lib/data/catalog";
import {
  approvePurchaseRequest,
  approveAndOrderPurchaseRequestNoPO,
  rejectPurchaseRequest,
  issuePurchaseRequestPO,
  orderPurchaseRequestNoPO,
  closePurchaseRequest,
} from "@/lib/data/actions";
import { FilterChips, SearchBox } from "@/components/filter-chips";
import type { FilterOption } from "@/components/filter-chips";

const inputCls =
  "rounded-lg border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";
const btnCls =
  "rounded-lg border border-black/20 px-3 py-1 text-xs font-medium dark:border-white/25";

// Request date (when it was raised), in Malaysia time → YYYY-MM-DD.
const reqDate = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date(iso));

// Aging colour: 48h+ red, 24h+ amber, else neutral. Applied to waiting requests.
function ageClass(hours: number): string {
  if (hours >= 48) return "text-red-600 dark:text-red-400 font-semibold";
  if (hours >= 24) return "text-amber-600 dark:text-amber-400 font-medium";
  return "text-black/50 dark:text-white/50";
}

export default async function OfficeRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const t = await getTranslations("Requests");
  const [rawRequests, suppliers] = await Promise.all([
    getOpenPurchaseRequests(),
    getSuppliers(),
  ]);
  const requests = await withSignedRequestPhotos(rawRequests);
  const activeSuppliers = suppliers.filter((s) => s.active);

  // Derive project list for filter chips from the fetched requests.
  const projectOptions: FilterOption[] = Array.from(
    new Map(
      requests
        .filter((r) => r.project?.name)
        .map((r) => [r.project_id, { label: r.project!.name!, value: r.project_id }]),
    ).values(),
  );

  const statusOptions: FilterOption[] = [
    { label: t("status.pending"), value: "pending" },
    { label: t("status.approved"), value: "approved" },
    { label: t("status.po_issued"), value: "po_issued" },
    { label: t("status.partial"), value: "partial" },
    { label: t("status.delivered"), value: "delivered" },
  ];

  // Supplier names that actually appear in the current queue (avoids showing
  // suppliers with no open requests as filter options).
  const activeSupplierNamesInQueue = new Set(
    requests.map((r) => r.supplier?.name).filter(Boolean),
  );
  const supplierOptions: FilterOption[] = activeSuppliers
    .filter((s) => activeSupplierNamesInQueue.has(s.name))
    .map((s) => ({ label: s.name, value: s.name }));

  // Server-side filter from URL params.
  const qProject = params.project ?? "";
  const qStatus = params.status ?? "";
  const qSupplier = params.supplier ?? "";
  const qSearch = (params.q ?? "").toLowerCase();

  const filtered = requests.filter((r) => {
    if (qProject && r.project_id !== qProject) return false;
    if (qStatus && r.status !== qStatus) return false;
    if (qSupplier && r.supplier?.name !== qSupplier) return false;
    if (qSearch) {
      const haystack = [
        r.project?.name ?? "",
        r.supplier?.name ?? "",
        ...r.items.map((i) => itemName(i)),
        r.note ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(qSearch)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t("queueTitle")}</h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          {t("queueHint")}
        </p>
      </div>

      {/* Filters — client components wrapped in Suspense for useSearchParams */}
      <Suspense>
        <div className="space-y-3 rounded-xl border border-black/10 p-3 dark:border-white/15">
          <SearchBox paramKey="q" placeholder={t("filterSearch")} />
          {projectOptions.length > 1 && (
            <FilterChips paramKey="project" options={projectOptions} label={t("filterProject")} allLabel={t("filterAll")} />
          )}
          <FilterChips paramKey="status" options={statusOptions} label={t("filterStatus")} allLabel={t("filterAll")} />
          {supplierOptions.length > 0 && (
            <FilterChips paramKey="supplier" options={supplierOptions} label={t("filterSupplier")} allLabel={t("filterAll")} />
          )}
        </div>
      </Suspense>

      {filtered.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => {
            const age = prAgeHours(r);
            return (
              <li
                key={r.id}
                className="space-y-2 rounded-xl border border-black/10 p-4 text-sm dark:border-white/15"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <ul className="font-medium">
                      {r.items.map((it) => (
                        <li key={it.id}>
                          {itemName(it)}
                          {it.quantity != null && (
                            <span className="text-black/60 dark:text-white/60">
                              {" "}
                              · {it.quantity}
                              {it.unit ? ` ${it.unit}` : ""}
                            </span>
                          )}
                          {it.spec && (
                            <span className="font-normal text-black/50 dark:text-white/50">
                              {" "}
                              — {it.spec}
                            </span>
                          )}
                          {r.status === "partial" &&
                            it.delivered_quantity != null &&
                            it.quantity != null && (
                              <span className="font-normal text-amber-700 dark:text-amber-400">
                                {" "}
                                · {t("deliveredSoFar", {
                                  delivered: it.delivered_quantity,
                                  ordered: it.quantity,
                                })}
                              </span>
                            )}
                        </li>
                      ))}
                    </ul>
                    <div className="text-xs text-black/50 dark:text-white/50">
                      {r.project?.name ? (
                        <Link
                          href={`/office/projects/${r.project_id}`}
                          className="underline"
                        >
                          {r.project.name}
                        </Link>
                      ) : null}
                      {` · ${t("requested")}: ${reqDate(r.created_at)}`}
                      {r.needed_by ? ` · ${t("neededBy")}: ${r.needed_by}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        r.status === "partial"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                          : "bg-black/5 dark:bg-white/10"
                      }`}
                    >
                      {t(`status.${r.status}`)}
                    </span>
                    {/* Aging clock only while the request is waiting on the
                        OFFICE (pending / Accepted). Once Ordered it's waiting on
                        the supplier/site, so the office nag stops. */}
                    {(r.status === "pending" || r.status === "approved") && (
                      <p className={`mt-1 text-xs ${ageClass(age)}`}>
                        {t("waiting", { hours: age })}
                      </p>
                    )}
                  </div>
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
                            className="h-20 w-20 rounded-lg object-cover"
                          />
                        </a>
                      ) : null,
                    )}
                  </div>
                )}

                {r.urgency_reason && (
                  <p className="text-black/60 dark:text-white/60">
                    {t("urgencyReason")}: {r.urgency_reason}
                  </p>
                )}
                {r.note && (
                  <p className="text-black/50 dark:text-white/50">{r.note}</p>
                )}
                {r.po_number && (
                  <p className="text-black/60 dark:text-white/60">
                    PO {r.po_number}
                    {r.supplier?.name ? ` · ${r.supplier.name}` : ""}
                  </p>
                )}

                {/* State-machine actions */}
                <div className="flex flex-wrap items-end gap-2 pt-1">
                  {r.status === "pending" && (
                    <>
                      <form action={approvePurchaseRequest}>
                        <input type="hidden" name="request_id" value={r.id} />
                        <input type="hidden" name="project_id" value={r.project_id} />
                        <button className={`${btnCls} text-green-700 dark:text-green-400`}>
                          {t("approve")}
                        </button>
                      </form>
                      <form action={approveAndOrderPurchaseRequestNoPO}>
                        <input type="hidden" name="request_id" value={r.id} />
                        <input type="hidden" name="project_id" value={r.project_id} />
                        <button className={btnCls}>{t("approveOrderNoPO")}</button>
                      </form>
                      <form
                        action={rejectPurchaseRequest}
                        className="flex items-end gap-1"
                      >
                        <input type="hidden" name="request_id" value={r.id} />
                        <input type="hidden" name="project_id" value={r.project_id} />
                        <input
                          name="rejected_reason"
                          placeholder={t("rejectReason")}
                          className={inputCls}
                        />
                        <button className={`${btnCls} text-red-600`}>
                          {t("reject")}
                        </button>
                      </form>
                    </>
                  )}

                  {r.status === "approved" && (
                    <>
                      <form
                        action={issuePurchaseRequestPO}
                        className="flex flex-wrap items-end gap-1"
                      >
                        <input type="hidden" name="request_id" value={r.id} />
                        <input type="hidden" name="project_id" value={r.project_id} />
                        <input
                          name="po_number"
                          required
                          placeholder={t("poNumber")}
                          className={inputCls}
                        />
                        <select name="supplier_id" defaultValue="" className={inputCls}>
                          <option value="">{t("supplier")}</option>
                          {activeSuppliers.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <button className={btnCls}>{t("issuePO")}</button>
                      </form>
                      <form action={orderPurchaseRequestNoPO}>
                        <input type="hidden" name="request_id" value={r.id} />
                        <input type="hidden" name="project_id" value={r.project_id} />
                        <button className={btnCls}>{t("orderNoPO")}</button>
                      </form>
                    </>
                  )}

                  {(r.status === "po_issued" || r.status === "partial") && (
                    <span className="text-xs text-black/50 dark:text-white/50">
                      {t("awaitingDelivery")}
                    </span>
                  )}

                  {(r.status === "approved" ||
                    r.status === "po_issued" ||
                    r.status === "partial") && (
                    <form action={closePurchaseRequest}>
                      <input type="hidden" name="request_id" value={r.id} />
                      <input type="hidden" name="project_id" value={r.project_id} />
                      <button className={btnCls}>{t("close")}</button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
