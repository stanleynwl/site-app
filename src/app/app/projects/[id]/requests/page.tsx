import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { getMaterials } from "@/lib/data/catalog";
import {
  getProjectPurchaseRequests,
  prMaterialName,
} from "@/lib/data/purchase-requests";
import { todayISO } from "@/lib/date";
import { PurchaseRequestForm } from "@/components/purchase-request-form";

export default async function ProjectRequestsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const t = await getTranslations("Requests");
  const [materials, requests] = await Promise.all([
    getMaterials(),
    getProjectPurchaseRequests(id),
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

      <PurchaseRequestForm
        projectId={id}
        today={todayISO()}
        materials={materials.filter((m) => m.active)}
      />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("recent")}</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{t("none")}</p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
            {requests.map((r) => (
              <li key={r.id} className="space-y-1 px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {prMaterialName(r)}
                    {r.quantity != null
                      ? ` · ${r.quantity}${r.unit ? ` ${r.unit}` : ""}`
                      : ""}
                  </span>
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                    {t(`status.${r.status}`)}
                  </span>
                </div>
                <div className="text-black/60 dark:text-white/60">
                  {r.needed_by ? `${t("neededBy")}: ${r.needed_by}` : ""}
                  {r.po_number ? ` · PO ${r.po_number}` : ""}
                </div>
                {r.urgency_reason && (
                  <p className="text-black/50 dark:text-white/50">
                    {r.urgency_reason}
                  </p>
                )}
                {r.status === "rejected" && r.rejected_reason && (
                  <p className="text-red-600">
                    {t("status.rejected")}: {r.rejected_reason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
