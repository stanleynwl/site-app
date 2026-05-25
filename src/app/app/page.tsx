import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getProjectsWithLatestReport } from "@/lib/data/projects";
import { todayISO } from "@/lib/date";

export default async function AppToday() {
  const t = await getTranslations("Today");
  const ts = await getTranslations("Status");
  const projects = await getProjectsWithLatestReport();
  const today = todayISO();

  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-black/50 dark:border-white/20 dark:text-white/50">
        {t("empty")}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {projects.map((p) => {
        const isToday = p.latest?.report_date === today;
        const label = isToday
          ? p.latest!.status === "draft"
            ? ts("todayDraft")
            : ts("todayDone")
          : ts("todayNone");
        const tone = !isToday
          ? "bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60"
          : p.latest!.status === "draft"
            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            : "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300";
        return (
          <li key={p.id}>
            <Link
              href={`/app/projects/${p.id}`}
              className="flex items-center justify-between rounded-xl border border-black/10 p-4 dark:border-white/15"
            >
              <span className="font-medium">{p.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${tone}`}>
                {label}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
