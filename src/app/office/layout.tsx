import { getTranslations } from "next-intl/server";
import { requireOfficeProfile } from "@/lib/auth/dal";
import { signOut } from "@/lib/auth/actions";
import { LocaleToggle } from "@/components/locale-toggle";
import { OfficeNavLink } from "@/components/office-nav-link";
import { LogoMark } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { getRecentActivity, type ActivityAction } from "@/lib/data/activity";

const ACTIVITY_ACTIONS: ActivityAction[] = [
  "report.submit", "report.unlock",
  "delivery.create", "delivery.update",
  "request.create", "request.approve", "request.reject", "request.order",
  "request.close", "request.delivered", "request.amend",
  "progress.submit", "stage.complete", "stage.reopen", "stock.count",
  "attendance.record", "advance.create",
  "claim.update", "claim.submit", "claim.verify", "claim.approve", "claim.revert",
];

export default async function OfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireOfficeProfile();
  const t = await getTranslations("Nav");
  const ta = await getTranslations("Activity");
  const tn = await getTranslations("Notifications");

  const recentActivity = await getRecentActivity(30);
  const activityLabels = Object.fromEntries(
    ACTIVITY_ACTIONS.map((a) => [a, ta(`action.${a}`)]),
  );

  const nav = [
    { href: "/office", label: t("dashboard") },
    { href: "/office/projects", label: t("projects") },
    { href: "/office/catalog", label: t("catalog") },
    { href: "/office/requests", label: t("requests") },
    { href: "/office/do-queue", label: t("doQueue") },
    { href: "/office/claims", label: t("claims") },
    { href: "/office/issues", label: t("issues") },
    { href: "/office/activity", label: t("activity") },
    { href: "/office/export", label: t("pdfExport") },
    ...(profile.is_admin ? [{ href: "/office/users", label: t("users") }] : []),
  ];

  return (
    <div className="flex min-h-full">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface p-4 md:flex">
        <div className="flex items-center justify-between gap-2 px-2">
          <div className="flex items-center gap-2.5">
            <LogoMark size={30} />
            <div className="leading-tight">
              <p className="text-sm font-semibold">SiteApp</p>
              <p className="text-[11px] text-muted">{t("office")}</p>
            </div>
          </div>
          <NotificationBell
            initial={recentActivity}
            labels={activityLabels}
            pollUrl="/api/office/activity"
            viewAllHref="/office/activity"
            seenKey="siteapp.office.activitySeen"
            align="left"
            strings={{
              title: tn("title"),
              viewAll: tn("viewAll"),
              empty: tn("empty"),
              enableAlerts: tn("enableAlerts"),
              alertsOn: tn("alertsOn"),
            }}
          />
        </div>
        <nav className="mt-7 flex flex-col gap-0.5">
          {nav.map((item) => (
            <OfficeNavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3 pt-4">
          <LocaleToggle />
          <form action={signOut}>
            <button className="text-sm text-muted hover:underline">
              {t("signOut")} · {profile.role}
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-6 md:p-8">{children}</main>
    </div>
  );
}
