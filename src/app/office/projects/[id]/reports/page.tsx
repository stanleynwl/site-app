import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { getProjectReports } from "@/lib/data/reports";
import { todayISO, daysAgoISO } from "@/lib/date";

// Full report timeline for a project + quick print actions (weekly preset and a
// link to the custom date-range export). Reuses the existing export print page.
export default async function ProjectReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, reports] = await Promise.all([
    getProject(id),
    getProjectReports(id),
  ]);
  if (!project) notFound();

  const t = await getTranslations("Office");
  const ts = await getTranslations("Status");
  const tr = await getTranslations("Report");
  const tpdf = await getTranslations("Pdf");

  // Weekly = the last 7 days (client progress template).
  const weeklyFrom = daysAgoISO(6);
  const weeklyTo = todayISO();
  const weeklyHref = `/office/export/print?project=${id}&audience=client&from=${weeklyFrom}&to=${weeklyTo}`;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/office/projects/${id}`}
          className="text-xs text-black/50 hover:underline dark:text-white/50"
        >
          ← {project.name}
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">{t("timeline")}</h1>
          <div className="flex flex-wrap gap-2">
            <Link href={weeklyHref} className="rounded-lg border border-black/20 px-3 py-1 text-xs font-medium dark:border-white/25">
              {tpdf("printWeekly")}
            </Link>
            <Link
              href={`/office/export?project=${id}`}
              className="rounded-lg border border-black/20 px-3 py-1 text-xs font-medium dark:border-white/25"
            >
              {tpdf("customRange")}
            </Link>
          </div>
        </div>
      </div>

      {reports.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">{t("noReports")}</p>
      ) : (
        <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
          {reports.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-4 py-3">
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
    </div>
  );
}
