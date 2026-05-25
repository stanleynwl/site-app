import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { getSuppliers, getMaterials } from "@/lib/data/catalog";
import {
  getProjectDeliveries,
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
  const [suppliers, materials, deliveries] = await Promise.all([
    getSuppliers(),
    getMaterials(),
    getProjectDeliveries(id),
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

      <DeliveryForm
        projectId={id}
        today={todayISO()}
        suppliers={suppliers.filter((s) => s.active)}
        materials={materials.filter((m) => m.active)}
      />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("recent")}</h2>
        {deliveries.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{t("none")}</p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
            {deliveries.map((d) => (
              <li key={d.id} className="px-4 py-3 text-sm">
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
                    ? ` · ${t("received")}: ${d.received_quantity}${d.unit ? ` ${d.unit}` : ""}`
                    : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
