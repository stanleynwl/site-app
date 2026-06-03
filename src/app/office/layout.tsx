import { getTranslations } from "next-intl/server";
import { requireOfficeProfile } from "@/lib/auth/dal";
import { signOut } from "@/lib/auth/actions";
import { LocaleToggle } from "@/components/locale-toggle";
import { OfficeNavLink } from "@/components/office-nav-link";

export default async function OfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireOfficeProfile();
  const t = await getTranslations("Nav");

  const nav = [
    { href: "/office", label: t("dashboard") },
    { href: "/office/projects", label: t("projects") },
    { href: "/office/catalog", label: t("catalog") },
    { href: "/office/requests", label: t("requests") },
    { href: "/office/do-queue", label: t("doQueue") },
    { href: "/office/activity", label: t("activity") },
    { href: "/office/export", label: t("pdfExport") },
    ...(profile.is_admin ? [{ href: "/office/users", label: t("users") }] : []),
  ];

  return (
    <div className="flex min-h-full">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface p-4 md:flex">
        <div className="flex items-center gap-2.5 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
            S
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">SiteApp</p>
            <p className="text-[11px] text-muted">{t("office")}</p>
          </div>
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
