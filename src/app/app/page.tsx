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
      <div className="card border-dashed p-8 text-center text-sm text-muted">
        {t("empty")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="section-title">{t("title")}</p>
      <ul className="space-y-2.5">
        {projects.map((p) => {
          const isToday = p.latest?.report_date === today;
          const label = isToday
            ? p.latest!.status === "draft"
              ? ts("todayDraft")
              : ts("todayDone")
            : ts("todayNone");
          const tone = !isToday
            ? "badge-muted"
            : p.latest!.status === "draft"
              ? "badge-warn"
              : "badge-success";
          return (
            <li key={p.id}>
              <Link
                href={`/app/projects/${p.id}`}
                className="card flex items-center justify-between p-4 transition-shadow hover:shadow-[var(--shadow-md)]"
              >
                <span className="font-medium">{p.name}</span>
                <span className={`badge ${tone}`}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
