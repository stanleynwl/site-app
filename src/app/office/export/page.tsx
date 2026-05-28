import { getTranslations } from "next-intl/server";
import { getMyProjects } from "@/lib/data/projects";
import { todayISO, daysAgoISO } from "@/lib/date";
import { ExportForm } from "@/components/export-form";

export default async function ExportPage() {
  const t = await getTranslations("Export");
  const projects = await getMyProjects();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-black/50 dark:text-white/50">{t("intro")}</p>
      </div>
      <ExportForm
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        today={todayISO()}
        defaultFrom={daysAgoISO(29)}
      />
    </div>
  );
}
