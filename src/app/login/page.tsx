import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LocaleToggle } from "@/components/locale-toggle";
import { LoginForm } from "@/components/login-form";
import { Logo } from "@/components/logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const t = await getTranslations("Login");

  return (
    <main className="relative flex min-h-full flex-1 items-center justify-center overflow-hidden p-6">
      <div className="blueprint absolute inset-0 opacity-50" />
      <div className="glow left-1/2 top-0 h-64 w-[36rem] -translate-x-1/2 bg-accent/20" />

      <div className="relative w-full max-w-sm">
        <div className="mb-5 flex items-center justify-between">
          <Link href="/" aria-label="SiteApp home">
            <Logo size={28} />
          </Link>
          <LocaleToggle />
        </div>

        <div className="card animate-rise p-8">
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("tagline")}</p>
          <LoginForm next={next ?? "/app"} />
        </div>

        <p className="mt-5 text-center text-xs text-muted">
          <Link href="/" className="hover:text-foreground">← Back to siteapp.com</Link>
        </p>
      </div>
    </main>
  );
}
