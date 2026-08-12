import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  getAllPurchaseOrders,
  poItemName,
  poTotal,
  poLabel,
  type PurchaseOrder,
} from "@/lib/data/purchase-orders";
import { FilterChips, SearchBox } from "@/components/filter-chips";
import type { FilterOption } from "@/components/filter-chips";
import { ScrollRestore } from "@/components/scroll-restore";

// Office-wide purchase order registry — every PO across every project, however
// it was raised: created here, or issued in the local office app and pushed up
// (see docs/PURCHASE_ORDER_SYNC.md). Mirrors the local app's top-level
// Purchase orders page so the two line up.

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CHIP: Record<string, string> = {
  draft: "bg-black/10 text-black/70 dark:bg-white/15 dark:text-white/70",
  issued: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
};

function fmtDate(po: PurchaseOrder): string {
  const iso = po.doc_date ? `${po.doc_date}T00:00:00` : (po.issued_at ?? po.created_at);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    dateStyle: "medium",
  }).format(new Date(iso));
}

// Free-text search across the fields someone would actually type: company, PO
// number, project, line items, remark and note.
function haystack(po: PurchaseOrder): string {
  return [
    po.po_number,
    po.supplier?.name ?? "",
    po.project?.name ?? "",
    po.remark ?? "",
    po.note ?? "",
    ...po.items.map((it) => poItemName(it)),
  ]
    .join(" ")
    .toLowerCase();
}

export default async function OfficePurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const t = await getTranslations("Po");
  const orders = await getAllPurchaseOrders();

  // Chips are built from what's actually present, so none filters to nothing.
  const supplierOptions: FilterOption[] = Array.from(
    new Set(orders.map((po) => po.supplier?.name).filter((n): n is string => !!n)),
  )
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ label: name, value: name }));

  const projectOptions: FilterOption[] = Array.from(
    new Set(orders.map((po) => po.project?.name).filter((n): n is string => !!n)),
  )
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ label: name, value: name }));

  const typeOptions: FilterOption[] = [
    { label: t("typePo"), value: "po" },
    { label: t("memoTitle"), value: "memo" },
  ];

  const qSupplier = sp.supplier ?? "";
  const qProject = sp.project ?? "";
  const qType = sp.type ?? "";
  const qSearch = (sp.q ?? "").trim().toLowerCase();

  const filtered = orders.filter((po) => {
    if (qSupplier && po.supplier?.name !== qSupplier) return false;
    if (qProject && po.project?.name !== qProject) return false;
    if (qType && po.doc_type !== qType) return false;
    if (qSearch && !haystack(po).includes(qSearch)) return false;
    return true;
  });

  const filtering = Boolean(qSupplier || qProject || qType || qSearch);

  // Hand the current filtered URL to each PO, so "← back" from the document
  // returns to this exact list instead of a bare one.
  const backTo = (() => {
    const p = new URLSearchParams();
    if (qSearch) p.set("q", sp.q ?? "");
    if (qSupplier) p.set("supplier", qSupplier);
    if (qProject) p.set("project", qProject);
    if (qType) p.set("type", qType);
    const qs = p.toString();
    return encodeURIComponent(`/office/purchase-orders${qs ? `?${qs}` : ""}`);
  })();

  return (
    <div className="space-y-5">
      <Suspense>
        <ScrollRestore scope="po-registry" />
      </Suspense>
      <div>
        <h1 className="text-xl font-semibold">{t("listTitle")}</h1>
        <p className="text-xs text-muted">{t("registryIntro")}</p>
      </div>

      {orders.length > 0 && (
        <Suspense>
          <div className="space-y-3 rounded-xl border border-border p-3">
            <SearchBox paramKey="q" placeholder={t("searchPlaceholder")} />
            {supplierOptions.length > 1 && (
              <FilterChips
                paramKey="supplier"
                options={supplierOptions}
                label={t("filterSupplier")}
                allLabel={t("filterAll")}
              />
            )}
            {projectOptions.length > 1 && (
              <FilterChips
                paramKey="project"
                options={projectOptions}
                label={t("filterProject")}
                allLabel={t("filterAll")}
              />
            )}
            <FilterChips
              paramKey="type"
              options={typeOptions}
              label={t("filterType")}
              allLabel={t("filterAll")}
            />
          </div>
        </Suspense>
      )}

      <p className="text-xs text-muted">
        {t("resultCount", { count: filtered.length })}
        {filtering && ` · ${money(filtered.reduce((sum, po) => sum + poTotal(po), 0))}`}
      </p>

      {orders.length === 0 ? (
        <p className="text-sm text-muted">{t("listEmpty")}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted">{t("noMatches")}</p>
      ) : (
        <ul className="card divide-y divide-border text-sm">
          {filtered.map((po) => (
            <li key={po.id}>
              <Link
                href={`/office/purchase-orders/${po.id}?back=${backTo}`}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
              >
                <div className="min-w-0">
                  <span className="font-medium">{poLabel(po)}</span>
                  {po.doc_type === "memo" && (
                    <span className="ml-1.5 rounded-full bg-black/10 px-2 py-0.5 text-xs font-medium dark:bg-white/15">
                      {t("memoTitle")}
                    </span>
                  )}
                  {po.is_bulk && (
                    <span className="ml-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-strong">
                      {t("bulkOrder")}
                    </span>
                  )}
                  {po.parent_po_number && (
                    <span className="ml-1.5 text-xs text-muted">
                      {t("against")} {po.parent_po_number}
                    </span>
                  )}
                  <span className="ml-2 text-muted">{po.supplier?.name ?? "—"}</span>
                  <span className="ml-2 text-xs text-muted">{po.project?.name ?? ""}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="tabular-nums">{money(poTotal(po))}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      CHIP[po.status] ?? CHIP.draft
                    }`}
                  >
                    {t(`status.${po.status}`)}
                  </span>
                  <span className="text-xs text-muted">{fmtDate(po)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
