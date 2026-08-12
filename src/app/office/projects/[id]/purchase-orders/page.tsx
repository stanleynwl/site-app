import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import {
  getProjectPurchaseOrders,
  poItemName,
  poTotal,
  poLabel,
} from "@/lib/data/purchase-orders";
import { FilterChips, SearchBox } from "@/components/filter-chips";
import type { FilterOption } from "@/components/filter-chips";
import { ScrollRestore } from "@/components/scroll-restore";

// Every PO raised for a project — web-generated and local-app rows alike, since
// both write to the same table. Filters live in the URL so the page stays
// server-rendered with the filtered set (same pattern as the request queue).

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CHIP: Record<string, string> = {
  draft: "bg-black/10 text-black/70 dark:bg-white/15 dark:text-white/70",
  issued: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
};

export default async function ProjectPurchaseOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const project = await getProject(id);
  if (!project) notFound();

  const t = await getTranslations("Po");
  const orders = await getProjectPurchaseOrders(id);

  // Supplier chips are built from the suppliers that actually appear on this
  // project's POs, so there are never chips that filter to nothing.
  const supplierOptions: FilterOption[] = Array.from(
    new Set(orders.map((po) => po.supplier?.name).filter((n): n is string => !!n)),
  )
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ label: name, value: name }));

  const qSupplier = sp.supplier ?? "";
  const qSearch = (sp.q ?? "").trim().toLowerCase();

  // Carry this list's filters onto each PO link so "← back" returns here with
  // the search still applied.
  const backTo = (() => {
    const p = new URLSearchParams();
    if (qSearch) p.set("q", sp.q ?? "");
    if (qSupplier) p.set("supplier", qSupplier);
    const qs = p.toString();
    return encodeURIComponent(
      `/office/projects/${id}/purchase-orders${qs ? `?${qs}` : ""}`,
    );
  })();

  const filtered = orders.filter((po) => {
    if (qSupplier && po.supplier?.name !== qSupplier) return false;
    if (qSearch) {
      const haystack = [
        po.po_number,
        po.supplier?.name ?? "",
        po.note ?? "",
        ...po.items.map((it) => poItemName(it)),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(qSearch)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <Suspense>
        <ScrollRestore scope="po-project" />
      </Suspense>
      <div>
        <Link href={`/office/projects/${id}`} className="text-xs text-muted hover:underline">
          ← {project.name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{t("listTitle")}</h1>
        <p className="text-xs text-muted">{t("listIntro")}</p>
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
          </div>
        </Suspense>
      )}

      {/* With a company filter on, the running total is the point of the view. */}
      {filtered.length > 0 && (qSupplier || qSearch) && (
        <p className="text-xs text-muted">
          {t("resultCount", { count: filtered.length })} ·{" "}
          {money(filtered.reduce((sum, po) => sum + poTotal(po), 0))}
        </p>
      )}

      {orders.length === 0 ? (
        <p className="text-sm text-muted">{t("listEmpty")}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted">{t("noMatches")}</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((po) => (
            <li key={po.id}>
              <Link
                href={`/office/purchase-orders/${po.id}?back=${backTo}`}
                className="card flex flex-wrap items-center justify-between gap-3 p-4 hover:border-accent"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {poLabel(po)}
                    {po.doc_type === "memo" && (
                      <span className="ml-1.5 rounded-full bg-black/10 px-2 py-0.5 text-xs font-medium dark:bg-white/15">
                        {t("memoTitle")}
                      </span>
                    )}
                    {po.supplier?.name ? (
                      <span className="text-muted"> · {po.supplier.name}</span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {po.items.map((it) => poItemName(it)).join(", ") || "—"}
                  </p>
                  {po.source === "local" && (
                    <p className="text-xs text-muted">{t("fromLocal")}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{money(poTotal(po))}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      CHIP[po.status] ?? CHIP.draft
                    }`}
                  >
                    {t(`status.${po.status}`)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
