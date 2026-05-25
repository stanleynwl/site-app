import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth/dal";
import { signOut } from "@/lib/auth/actions";
import { LocaleToggle } from "@/components/locale-toggle";

export default async function OfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const t = await getTranslations("Nav");

  const nav = [
    { href: "/office", label: t("dashboard") },
    { href: "/office/projects", label: t("projects") },
    { href: "/office/catalog", label: t("catalog") },
    { href: "/office/do-queue", label: t("doQueue") },
    { href: "/office/export", label: t("pdfExport") },
  ];

  return (
    <div className="flex min-h-full">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-black/10 p-4 md:flex dark:border-white/15">
        <p className="text-lg font-semibold">SiteApp</p>
        <p className="text-xs text-black/50 dark:text-white/50">{t("office")}</p>
        <nav className="mt-6 flex flex-col gap-1 text-sm">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3 pt-4">
          <LocaleToggle />
          <form action={signOut}>
            <button className="text-sm text-black/60 hover:underline dark:text-white/60">
              {t("signOut")} · {profile.role}
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
