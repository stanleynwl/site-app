import { getTranslations } from "next-intl/server";

export default async function OfflinePage() {
  const t = await getTranslations("Offline");
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-4xl">📵</div>
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="max-w-xs text-sm text-black/70 dark:text-white/70">
        {t("body")}
      </p>
      <p className="max-w-xs rounded-lg bg-black/5 px-4 py-3 text-xs text-black/60 dark:bg-white/5 dark:text-white/60">
        {t("hint")}
      </p>
    </main>
  );
}
