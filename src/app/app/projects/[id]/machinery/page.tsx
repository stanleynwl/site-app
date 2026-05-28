import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { getMachines, getProjectMachineLogs } from "@/lib/data/machinery";
import { todayISO } from "@/lib/date";
import { MachineLogForm } from "@/components/machine-log-form";

export default async function ProjectMachineryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const t = await getTranslations("Machinery");
  const [machines, logs] = await Promise.all([
    getMachines(),
    getProjectMachineLogs(id),
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

      <MachineLogForm
        projectId={id}
        today={todayISO()}
        machines={machines.filter((m) => m.active)}
      />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("recent")}</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{t("none")}</p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
            {logs.map((l) => (
              <li key={l.id} className="space-y-1 px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{l.machine?.name ?? "—"}</span>
                  <span className="text-black/50 dark:text-white/50">
                    {l.log_date}
                  </span>
                </div>
                <div className="text-black/60 dark:text-white/60">
                  {l.present ? t("present") : t("absent")}
                  {l.hours_worked != null ? ` · ${l.hours_worked}h` : ""}
                  {l.fuel_litres != null ? ` · ${l.fuel_litres}L` : ""}
                  {l.operator ? ` · ${l.operator}` : ""}
                </div>
                {l.breakdown && (
                  <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                    {t("breakdown")}
                    {l.breakdown_note ? `: ${l.breakdown_note}` : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
