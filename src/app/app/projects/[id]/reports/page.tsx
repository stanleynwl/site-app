import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import {
  getProjectReports,
  getRecentReportsWithChildren,
} from "@/lib/data/reports";
import { ReadOnlyReport } from "@/components/read-only-report";

// How many days the site sees at once, and the steps "show older" walks through.
const PAGE_SIZES = [14, 30, 90, 365];

// Past daily reports, read-only — for when site wants to check back what was
// recorded on a day. Each day collapses; the newest is open on arrival.
export default async function SiteReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ limit?: string }>;
}) {
  const { id } = await params;
  const { limit: limitParam } = await searchParams;
  const limit = PAGE_SIZES.includes(Number(limitParam))
    ? Number(limitParam)
    : PAGE_SIZES[0];

  const [project, reports, all] = await Promise.all([
    getProject(id),
    getRecentReportsWithChildren(id, limit),
    getProjectReports(id),
  ]);
  if (!project) notFound();

  const t = await getTranslations("Report");
  const ts = await getTranslations("Status");
  const nextSize = PAGE_SIZES.find((n) => n > limit && n < all.length);

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/app/projects/${id}`}
          className="text-xs text-black/60 underline dark:text-white/60"
        >
          ← {project.name}
        </Link>
        <h1 className="mt-1 text-lg font-semibold">{t("history")}</h1>
        <p className="text-xs text-black/70 dark:text-white/70">
          {t("historySubtitle")}
        </p>
      </div>

      {reports.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          {t("historyEmpty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {reports.map((r, i) => (
            <li key={r.id} className="card p-0">
              <details open={i === 0} className="group">
                <summary className="flex cursor-pointer select-none flex-wrap items-center gap-2 p-3">
                  <span className="font-medium">{r.report_date}</span>
                  <span className="badge badge-muted">{ts(r.status)}</span>
                  {r.report_type === "no_work" && (
                    <span className="badge badge-warn">
                      {t("reportType.no_work")}
                    </span>
                  )}
                  {r.is_backdated && (
                    <span className="badge badge-warn">{t("backdatedBadge")}</span>
                  )}
                  <span className="ml-auto text-black/40 transition-transform group-open:rotate-90 dark:text-white/40">
                    ›
                  </span>
                </summary>
                <div className="border-t border-black/10 p-3 dark:border-white/10">
                  <ReadOnlyReport report={r} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      {nextSize && (
        <Link
          href={`/app/projects/${id}/reports?limit=${nextSize}`}
          className="inline-block text-sm underline"
        >
          {t("historyShowOlder")}
        </Link>
      )}
    </div>
  );
}
