import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { getMaterials } from "@/lib/data/catalog";
import { getProjectStockCounts, getStockSummary } from "@/lib/data/stock";
import { todayISO } from "@/lib/date";
import { StockCountForm } from "@/components/stock-count-form";

export default async function ProjectStockPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const t = await getTranslations("Stock");
  const [materials, counts, summary] = await Promise.all([
    getMaterials(),
    getProjectStockCounts(id),
    getStockSummary(id),
  ]);

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

      <StockCountForm
        projectId={id}
        today={todayISO()}
        materials={materials.filter((m) => m.active)}
      />

      {/* On-hand summary + derived consumption ---------------------------- */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("onHand")}</h2>
        {summary.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{t("none")}</p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
            {summary.map((s) => (
              <li key={s.material_id} className="space-y-1 px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{s.material_name}</span>
                  <span>
                    {s.latest_qty}
                    {s.unit ? ` ${s.unit}` : ""}
                  </span>
                </div>
                <div className="text-xs text-black/50 dark:text-white/50">
                  {t("countedOn", { date: s.latest_date })}
                  {s.consumption != null
                    ? ` · ${t("consumedSince", { qty: s.consumption, date: s.previous_date ?? "" })}`
                    : ` · ${t("firstCount")}`}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("recent")}</h2>
        {counts.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{t("none")}</p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
            {counts.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span>
                  <span className="font-medium">{c.material?.name ?? "—"}</span>
                  {c.note && (
                    <span className="ml-2 text-black/50 dark:text-white/50">
                      {c.note}
                    </span>
                  )}
                </span>
                <span className="text-black/60 dark:text-white/60">
                  {c.quantity}
                  {c.unit ? ` ${c.unit}` : ""} · {c.count_date}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
