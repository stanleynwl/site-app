import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getProjectsWithLatestReport } from "@/lib/data/projects";
import {
  getTodayReportsByProject,
  getOpenIssueCountsByProject,
} from "@/lib/data/reports";
import { getOpenRequestCountsByProject } from "@/lib/data/purchase-requests";
import { getPendingDoCountByProject } from "@/lib/data/deliveries";
import { getProjectIdsWithNewStructure } from "@/lib/data/structure";

export default async function OfficeDashboard() {
  const t = await getTranslations("Dashboard");
  const ti = await getTranslations("Issues");
  const [projects, todayMap, requestMap, doMap, issueMap] = await Promise.all([
    getProjectsWithLatestReport(),
    getTodayReportsByProject(),
    getOpenRequestCountsByProject(),
    getPendingDoCountByProject(),
    getOpenIssueCountsByProject(),
  ]);
  const { newProgress, newStages } = await getProjectIdsWithNewStructure(projects);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 p-10 text-center text-sm text-black/50 dark:border-white/20 dark:text-white/50">
          {t("empty")}
        </div>
      ) : (
        <ul className="space-y-2">
          {projects.map((p) => {
            const todayStatus = todayMap[p.id];
            const req = requestMap[p.id];
            const doCount = doMap[p.id] ?? 0;
            const issueCount = issueMap[p.id] ?? 0;
            const hasNewActivity = newProgress.has(p.id) || newStages.has(p.id);

            return (
              <li key={p.id}>
                <Link
                  href={`/office/projects/${p.id}`}
                  className="flex items-center gap-3 rounded-xl border border-black/10 p-4 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
                >
                  {/* Project name */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name}</p>
                    {p.code && (
                      <p className="text-xs text-black/50 dark:text-white/50">
                        {p.code}
                      </p>
                    )}
                  </div>

                  {/* Status chips — today's report / open requests / pending DOs */}
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {/* Report chip */}
                    {todayStatus === "submitted" || todayStatus === "locked" ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300">
                        {t("reportSubmitted")}
                      </span>
                    ) : todayStatus === "draft" ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                        {t("reportDraft")}
                      </span>
                    ) : (
                      <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-black/50 dark:bg-white/10 dark:text-white/50">
                        {t("reportNone")}
                      </span>
                    )}

                    {/* Open requests chip */}
                    {req && req.total > 0 && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          req.aged > 0
                            ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                        }`}
                      >
                        {req.total} {t("openRequests")}
                        {req.aged > 0 && ` · ${t("requestsAged", { n: req.aged })}`}
                      </span>
                    )}

                    {/* Pending DOs chip */}
                    {doCount > 0 && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        {doCount} {t("pendingDOs")}
                      </span>
                    )}

                    {/* Open issues chip */}
                    {issueCount > 0 && (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
                        {ti("countOpen", { n: issueCount })}
                      </span>
                    )}

                    {/* New progress / stages activity */}
                    {hasNewActivity && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                        {t("newStructure")}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
