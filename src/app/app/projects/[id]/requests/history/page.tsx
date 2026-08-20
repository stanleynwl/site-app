import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import {
  getProjectPurchaseRequests,
  isRequestVisible,
  itemName,
} from "@/lib/data/purchase-requests";

// Past orders, read-only — for when site wants to check back what was ordered
// and how much of it actually arrived. The live requests list drops a delivered
// order once its hold window passes (DELIVERED_HOLD_DAYS), so without this page
// there is no way to look one up afterwards.

// How many orders the site sees at once, and the steps "show older" walks.
const PAGE_SIZES = [20, 50, 200];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    dateStyle: "medium",
  }).format(new Date(iso));
}

export default async function SiteRequestHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ limit?: string }>;
}) {
  const { id } = await params;
  const { limit: limitParam } = await searchParams;
  const limit = PAGE_SIZES.includes(Number(limitParam))
    ? Number(limitParam)
    : PAGE_SIZES[0];

  const [project, all] = await Promise.all([
    getProject(id),
    getProjectPurchaseRequests(id),
  ]);
  if (!project) notFound();

  const t = await getTranslations("Requests");

  // Exactly the orders that have left the live list — so the two views together
  // cover everything without repeating anything.
  const past = all.filter((r) => !isRequestVisible(r));
  const shown = past.slice(0, limit);
  const nextSize = PAGE_SIZES.find((n) => n > limit && n < past.length);

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/app/projects/${id}/requests`}
          className="text-xs text-black/60 underline dark:text-white/60"
        >
          ← {t("title")}
        </Link>
        <h1 className="mt-1 text-lg font-semibold">{t("historyTitle")}</h1>
        <p className="text-xs text-black/70 dark:text-white/70">
          {t("historySubtitle")}
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          {t("historyEmpty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((r) => (
            <li key={r.id} className="card space-y-2 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-black/60 dark:text-white/60">
                  {t("requested")}: {fmtDate(r.created_at)}
                </span>
                <span
                  className={`badge ${
                    r.status === "rejected"
                      ? "badge-danger"
                      : r.status === "delivered"
                        ? "badge-success"
                        : "badge-muted"
                  }`}
                >
                  {t(`status.${r.status}`)}
                </span>
              </div>

              <ul className="space-y-0.5">
                {r.items.map((it) => {
                  // What actually turned up against what was asked for — the
                  // whole point of looking back at an old order.
                  //
                  // A null delivered_quantity means nobody counted it, NOT that
                  // nothing came: most delivered lines here were never counted.
                  // Showing "0 / 300" for those would read as a total failure,
                  // so an uncounted line just shows what was ordered.
                  const counted = it.delivered_quantity != null;
                  const short =
                    counted && it.quantity != null && it.delivered_quantity! < it.quantity;
                  return (
                    <li key={it.id}>
                      <span className="font-medium">{itemName(it)}</span>
                      {it.quantity != null && (
                        <span
                          className={
                            short
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-black/60 dark:text-white/60"
                          }
                        >
                          {" · "}
                          {counted
                            ? `${it.delivered_quantity} / ${it.quantity}`
                            : it.quantity}
                          {it.unit ? ` ${it.unit}` : ""}
                        </span>
                      )}
                      {it.spec && (
                        <span className="text-black/50 dark:text-white/50">
                          {" "}
                          — {it.spec}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>

              <div className="text-xs text-black/60 dark:text-white/60">
                {r.supplier?.name ?? "—"}
                {r.po_number ? ` · ${r.po_number}` : ""}
                {r.delivered_at ? ` · ${t("delivered")}: ${fmtDate(r.delivered_at)}` : ""}
              </div>

              {r.status === "rejected" && r.rejected_reason && (
                <p className="text-xs text-red-700 dark:text-red-400">
                  {r.rejected_reason}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {nextSize && (
        <Link
          href={`/app/projects/${id}/requests/history?limit=${nextSize}`}
          className="inline-block text-sm underline"
        >
          {t("historyShowOlder")}
        </Link>
      )}
    </div>
  );
}
