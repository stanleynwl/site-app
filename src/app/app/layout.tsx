import { getTranslations } from "next-intl/server";
import { requireSiteProfile } from "@/lib/auth/dal";
import { signOut } from "@/lib/auth/actions";
import { LocaleToggle } from "@/components/locale-toggle";
import { AppNavLink } from "@/components/app-nav-link";
import { LogoMark } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { getRecentActivity, REQUEST_OFFICE_ACTIONS } from "@/lib/data/activity";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireSiteProfile();
  const t = await getTranslations("Nav");
  const ta = await getTranslations("Activity");
  const tn = await getTranslations("Notifications");

  // Notify the supervisor when the office acts on their requests.
  const requestUpdates = await getRecentActivity(30, REQUEST_OFFICE_ACTIONS);
  const activityLabels = Object.fromEntries(
    REQUEST_OFFICE_ACTIONS.map((a) => [a, ta(`action.${a}`)]),
  );

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <LogoMark size={26} />
          <div className="leading-tight">
            <p className="text-sm font-semibold">SiteApp</p>
            <p className="text-xs text-muted">
              {profile.full_name ?? profile.username} · {profile.role}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell
            initial={requestUpdates}
            labels={activityLabels}
            pollUrl="/api/site/activity"
            viewAllHref="/app/activity"
            seenKey="siteapp.site.activitySeen"
            strings={{
              title: tn("title"),
              viewAll: tn("viewAll"),
              empty: tn("empty"),
              enableAlerts: tn("enableAlerts"),
              alertsOn: tn("alertsOn"),
            }}
          />
          <LocaleToggle />
          <form action={signOut}>
            <button className="text-sm text-muted underline-offset-2 hover:text-foreground hover:underline">
              {t("signOut")}
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 p-4">{children}</main>

      <nav className="sticky bottom-0 z-20 grid grid-cols-2 border-t border-border bg-surface/90 backdrop-blur-md">
        <AppNavLink href="/app" label={t("today")} icon="today" />
        <AppNavLink href="/app/projects" label={t("projects")} icon="projects" />
      </nav>
    </div>
  );
}
