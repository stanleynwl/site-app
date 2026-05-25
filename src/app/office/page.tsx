import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getProjectsWithLatestReport } from "@/lib/data/projects";

export default async function OfficeDashboard() {
  const t = await getTranslations("Dashboard");
  const tr = await getTranslations("Report");
  const ts = await getTranslations("Status");
  const projects = await getProjectsWithLatestReport();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 p-10 text-center text-sm text-black/50 dark:border-white/20 dark:text-white/50">
          {t("empty")}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/office/projects/${p.id}`}
                className="block h-full rounded-xl border border-black/10 p-4 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
              >
                <p className="font-medium">{p.name}</p>
                {p.code && (
                  <p className="text-xs text-black/50 dark:text-white/50">
                    {p.code}
                  </p>
                )}
                <p className="mt-3 text-xs font-medium text-black/50 dark:text-white/50">
                  {t("latestReport")}
                </p>
                {p.latest ? (
                  <p className="text-sm">
                    {p.latest.report_date} · {ts(p.latest.status)}
                    {p.latest.weather
                      ? ` · ${tr(`weatherOpt.${p.latest.weather}`)}`
                      : ""}
                  </p>
                ) : (
                  <p className="text-sm text-black/40 dark:text-white/40">
                    {t("noReports")}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
