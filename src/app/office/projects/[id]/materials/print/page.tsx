import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { itemName, daysBetween } from "@/lib/data/purchase-requests";
import {
  getProcurementView,
  mytDate,
  mytDateTime,
} from "@/lib/data/materials-register";
import { todayISO } from "@/lib/date";
import { PrintButton } from "@/components/print-button";

const thCls = "border border-black/30 px-2 py-1 text-left font-semibold";
const tdCls = "border border-black/20 px-2 py-1 align-top";

// Print-optimized Materials Procurement Register → browser "Save as PDF". Honors
// the same URL filters as the screen page so what you see is what you file.
export default async function MaterialsRegisterPrintPage({
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

  const t = await getTranslations("Materials");
  const treq = await getTranslations("Requests");
  const tp = await getTranslations("Pdf");

  const { filtered, summary } = await getProcurementView(id, {
    month: sp.month,
    status: sp.status,
    supplier: sp.supplier,
    q: sp.q,
  });

  const qs = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => v) as [string, string][],
  ).toString();

  return (
    <div className="mx-auto max-w-4xl space-y-6 text-black">
      <div className="no-print flex items-center justify-between">
        <Link
          href={`/office/projects/${id}/materials${qs ? `?${qs}` : ""}`}
          className="text-sm text-black/50 underline dark:text-white/60"
        >
          ← {t("title")}
        </Link>
        <PrintButton />
      </div>

      <article className="space-y-4 rounded-lg border border-black/15 bg-white p-8 text-sm leading-relaxed text-black print:border-0 print:p-0">
        <header className="border-b border-black/20 pb-3">
          <h1 className="text-lg font-bold">{project.name}</h1>
          <p className="text-black/60">
            {[project.code, project.location].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-2 font-semibold">{t("title")}</p>
          <p className="text-black/60">
            {t("statTotal")}: {summary.total} · {t("statDelivered")}: {summary.delivered}{" "}
            · {t("statOutstanding")}: {summary.outstanding} · {t("statOverdue")}:{" "}
            {summary.overdue}
            {summary.avgRequestToOrderDays != null
              ? ` · ${t("statReqToOrder")} ${summary.avgRequestToOrderDays}${t("daysSuffix")}`
              : ""}
            {summary.avgOrderToDeliveryDays != null
              ? ` · ${t("statOrderToDeliver")} ${summary.avgOrderToDeliveryDays}${t("daysSuffix")}`
              : ""}
          </p>
        </header>

        {filtered.length === 0 ? (
          <p className="text-black/60">{t("empty")}</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className={thCls}>{t("colRequested")}</th>
                <th className={thCls}>{t("colMaterial")}</th>
                <th className={thCls}>{t("colStatus")}</th>
                <th className={thCls}>{t("colOrdered")}</th>
                <th className={thCls}>{t("colDelivered")}</th>
                <th className={thCls}>{t("colLeadDays")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className={tdCls}>{mytDateTime(r.created_at)}</td>
                  <td className={tdCls}>
                    {r.items.map((it) => (
                      <div key={it.id}>
                        {itemName(it)}
                        {it.quantity != null
                          ? ` · ${it.quantity}${it.unit ? ` ${it.unit}` : ""}`
                          : ""}
                        {it.spec ? ` — ${it.spec}` : ""}
                      </div>
                    ))}
                  </td>
                  <td className={tdCls}>{treq(`status.${r.status}`)}</td>
                  <td className={tdCls}>
                    {mytDate(r.ordered_at)}
                    {r.po_number ? ` · PO ${r.po_number}` : ""}
                    {r.supplier?.name ? ` · ${r.supplier.name}` : ""}
                  </td>
                  <td className={tdCls}>{mytDate(r.delivered_at)}</td>
                  <td className={tdCls}>
                    {daysBetween(r.created_at, r.delivered_at) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <footer className="border-t border-black/20 pt-3 text-xs text-black/50">
          {tp("generated", { date: todayISO() })}
        </footer>
      </article>
    </div>
  );
}
