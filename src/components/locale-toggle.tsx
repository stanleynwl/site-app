"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Fragment, useTransition } from "react";
import { SUPPORTED_LOCALES } from "@/i18n/locales";

export function LocaleToggle() {
  const locale = useLocale();
  const t = useTranslations("Locale");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: string) {
    document.cookie = `locale=${next};path=/;max-age=31536000;samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div className="inline-flex items-center gap-1 text-xs" aria-busy={isPending}>
      {SUPPORTED_LOCALES.map((code, i) => (
        <Fragment key={code}>
          {i > 0 && <span className="opacity-30">·</span>}
          <button
            onClick={() => switchTo(code)}
            className={locale === code ? "font-semibold underline" : "opacity-60"}
          >
            {t(code)}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
