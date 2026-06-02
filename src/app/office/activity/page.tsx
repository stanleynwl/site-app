import { getTranslations } from "next-intl/server";
import { getRecentActivity } from "@/lib/data/activity";
import { ActivityFeed } from "@/components/activity-feed";

// Global office activity feed across all projects (newest first).
export default async function OfficeActivityPage() {
  const t = await getTranslations("Activity");
  const entries = await getRecentActivity(150);

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-black/50 dark:text-white/50">{t("intro")}</p>
      </div>
      <ActivityFeed entries={entries} showProject />
    </div>
  );
}
