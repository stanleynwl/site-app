import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { getProjectReports } from "@/lib/data/reports";
import {
  getProjectDeliveries,
  deliveryMaterialName,
  deliveryVariance,
} from "@/lib/data/deliveries";
import { setDoQuantity } from "@/lib/data/actions";

export default async function OfficeProjectDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const t = await getTranslations("Office");
  const ts = await getTranslations("Status");
  const tr = await getTranslations("Report");
  const td = await getTranslations("Deliveries");
  const [reports, deliveries] = await Promise.all([
    getProjectReports(id),
    getProjectDeliveries(id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/office/projects"
          className="text-xs text-black/50 hover:underline dark:text-white/50"
        >
          ← {t("backToProjects")}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{project.name}</h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          {[project.code, project.location].filter(Boolean).join(" · ")}
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold">{t("timeline")}</h2>
        {reports.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            {t("noReports")}
          </p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
            {reports.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="text-sm">
                  <span className="font-medium">{r.report_date}</span>
                  <span className="ml-2 text-black/50 dark:text-white/50">
                    {ts(r.status)}
                    {r.is_backdated ? ` · ${tr("backdatedBadge")}` : ""}
                    {r.weather ? ` · ${tr(`weatherOpt.${r.weather}`)}` : ""}
                  </span>
                </div>
                <Link
                  href={`/office/projects/${id}/reports/${r.id}`}
                  className="text-sm underline"
                >
                  {t("view")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">{td("title")}</h2>
        {deliveries.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{td("none")}</p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
            {deliveries.map((d) => {
              const variance = deliveryVariance(d);
              return (
                <li key={d.id} className="space-y-2 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{deliveryMaterialName(d)}</span>
                    <span className="text-black/50 dark:text-white/50">
                      {d.delivered_on}
                    </span>
                  </div>
                  <div className="text-black/60 dark:text-white/60">
                    {d.supplier?.name ?? "—"}
                    {d.do_number ? ` · DO ${d.do_number}` : ""}
                    {d.received_quantity != null
                      ? ` · ${td("received")}: ${d.received_quantity}${d.unit ? ` ${d.unit}` : ""}`
                      : ""}
                    {variance != null ? ` · ${td("variance")}: ${variance}` : ""}
                  </div>
                  {/* Office enters the DO quantity from the DO photo */}
                  <form
                    action={setDoQuantity}
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="delivery_id" value={d.id} />
                    <input type="hidden" name="project_id" value={id} />
                    <span className="text-black/60 dark:text-white/60">
                      {td("doQuantity")}
                    </span>
                    <input
                      type="number"
                      name="do_quantity"
                      min="0"
                      step="0.001"
                      defaultValue={d.do_quantity ?? ""}
                      className="w-28 rounded-lg border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
                    />
                    <button className="rounded-lg border border-black/20 px-3 py-1 text-xs font-medium dark:border-white/25">
                      {td("save")}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
