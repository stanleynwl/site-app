import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { getSuppliers, getMaterials } from "@/lib/data/catalog";
import {
  getProjectDeliveries,
  withSignedUrls,
  deliveryMaterialName,
} from "@/lib/data/deliveries";
import { todayISO } from "@/lib/date";
import { DeliveryForm } from "@/components/delivery-form";

export default async function DeliveriesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const t = await getTranslations("Deliveries");
  const [suppliers, materials, rawDeliveries] = await Promise.all([
    getSuppliers(),
    getMaterials(),
    getProjectDeliveries(id),
  ]);
  const deliveries = await withSignedUrls(rawDeliveries);

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/app/projects/${id}`}
          className="text-xs text-black/70 hover:underline dark:text-white/70"
        >
          ← {project.name}
        </Link>
        <h1 className="mt-1 text-lg font-semibold">{t("title")}</h1>
      </div>

      <DeliveryForm
        projectId={id}
        today={todayISO()}
        suppliers={suppliers.filter((s) => s.active)}
        materials={materials.filter((m) => m.active)}
      />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("recent")}</h2>
        {deliveries.length === 0 ? (
          <p className="text-sm text-black/70 dark:text-white/70">{t("none")}</p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
            {deliveries.map((d) => (
              <li key={d.id} className="space-y-2 px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{deliveryMaterialName(d)}</span>
                  <span className="text-black/70 dark:text-white/70">
                    {d.delivered_on}
                  </span>
                </div>
                <div className="text-black/60 dark:text-white/60">
                  {d.supplier?.name ?? "—"}
                  {d.do_number ? ` · DO ${d.do_number}` : ""}
                  {d.received_quantity != null
                    ? ` · ${t("received")}: ${d.received_quantity}${d.unit ? ` ${d.unit}` : ""}`
                    : ""}
                </div>
                {d.issue_type && (
                  <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                    {t(`issueType.${d.issue_type}`)}
                    {d.note ? `: ${d.note}` : ""}
                  </span>
                )}
                {d.photos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {d.photos.map((p) =>
                      p.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={p.id}
                          src={p.url}
                          alt=""
                          className="h-16 w-16 rounded-lg object-cover"
                        />
                      ) : null,
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
