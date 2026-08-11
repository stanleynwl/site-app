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

// Every PO raised for a project — web-generated and local-app rows alike, since
// both write to the same table.

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CHIP: Record<string, string> = {
  draft: "bg-black/10 text-black/70 dark:bg-white/15 dark:text-white/70",
  issued: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
};

export default async function ProjectPurchaseOrdersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const t = await getTranslations("Po");
  const orders = await getProjectPurchaseOrders(id);

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/office/projects/${id}`} className="text-xs text-muted hover:underline">
          ← {project.name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{t("listTitle")}</h1>
        <p className="text-xs text-muted">{t("listIntro")}</p>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-muted">{t("listEmpty")}</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((po) => (
            <li key={po.id}>
              <Link
                href={`/office/purchase-orders/${po.id}`}
                className="card flex flex-wrap items-center justify-between gap-3 p-4 hover:border-accent"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {poLabel(po)}
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
