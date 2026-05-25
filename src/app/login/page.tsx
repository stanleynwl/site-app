import { getTranslations } from "next-intl/server";
import { LocaleToggle } from "@/components/locale-toggle";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const t = await getTranslations("Login");

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 p-8 shadow-sm dark:border-white/15">
        <div className="flex items-start justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">SiteApp</h1>
          <LocaleToggle />
        </div>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          {t("tagline")}
        </p>

        <LoginForm next={next ?? "/app"} />
      </div>
    </main>
  );
}
