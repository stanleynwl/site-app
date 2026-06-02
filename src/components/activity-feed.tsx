import { getTranslations } from "next-intl/server";
import type { ActivityEntry } from "@/lib/data/activity";

function fmt(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

// Chronological who-did-what feed. action label is translated; detail is data
// (names / numbers) shown as-is. Used by the global + per-project Activity pages.
export async function ActivityFeed({
  entries,
  showProject = false,
}: {
  entries: ActivityEntry[];
  showProject?: boolean;
}) {
  const t = await getTranslations("Activity");

  if (entries.length === 0) {
    return <p className="text-sm text-black/50 dark:text-white/50">{t("empty")}</p>;
  }

  return (
    <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
      {entries.map((e) => (
        <li key={e.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
          <div>
            <span className="font-medium">{e.actor_name}</span>{" "}
            <span className="text-black/70 dark:text-white/70">
              {t(`action.${e.action}`)}
            </span>
            {e.detail ? (
              <span className="text-black/60 dark:text-white/60"> · {e.detail}</span>
            ) : null}
            {showProject && e.project_name ? (
              <div className="text-xs text-black/45 dark:text-white/45">
                {e.project_name}
              </div>
            ) : null}
          </div>
          <time className="shrink-0 text-xs text-black/45 dark:text-white/45">
            {fmt(e.created_at)}
          </time>
        </li>
      ))}
    </ul>
  );
}
