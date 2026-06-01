import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSiteProfile } from "@/lib/auth/dal";
import { signOut } from "@/lib/auth/actions";
import { LocaleToggle } from "@/components/locale-toggle";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireSiteProfile();
  const t = await getTranslations("Nav");

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/15">
        <div>
          <p className="text-base font-semibold leading-tight">SiteApp</p>
          <p className="text-xs text-black/50 dark:text-white/50">
            {profile.full_name ?? profile.username} · {profile.role}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LocaleToggle />
          <form action={signOut}>
            <button className="text-sm text-black/60 underline-offset-2 hover:underline dark:text-white/60">
              {t("signOut")}
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 p-4">{children}</main>

      <nav className="grid grid-cols-2 border-t border-black/10 text-center text-sm dark:border-white/15">
        <Link href="/app" className="py-3 font-medium">
          {t("today")}
        </Link>
        <Link href="/app/projects" className="py-3 text-black/60 dark:text-white/60">
          {t("projects")}
        </Link>
      </nav>
    </div>
  );
}
