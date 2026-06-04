import { getTranslations } from "next-intl/server";
import { getRecentActivity } from "@/lib/data/activity";
import { ActivityFeed } from "@/components/activity-feed";

// Supervisor's activity feed — their projects' recent events (office approvals
// and orders on requests, plus reports/deliveries/progress in their projects).
export default async function SiteActivityPage() {
  const t = await getTranslations("Activity");
  const entries = await getRecentActivity(100);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <p className="text-xs text-muted">{t("intro")}</p>
      </div>
      <ActivityFeed entries={entries} showProject />
    </div>
  );
}
