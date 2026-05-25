"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const inputClass =
  "rounded-lg border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

// Lets a supervisor jump to a past date to backfill a missed report.
// Bounded by [minDate, today]; selecting today clears the ?date= param.
export function ReportDateNav({
  date,
  today,
  minDate,
}: {
  date: string;
  today: string;
  minDate: string;
}) {
  const t = useTranslations("Report");
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-3 text-sm">
      <label className="flex items-center gap-2">
        <span className="text-black/60 dark:text-white/60">{t("reportDate")}</span>
        <input
          type="date"
          value={date}
          min={minDate}
          max={today}
          onChange={(e) => {
            const v = e.target.value;
            if (!v || v === today) router.push(pathname);
            else router.push(`${pathname}?date=${v}`);
          }}
          className={inputClass}
        />
      </label>
      {date !== today && (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="underline"
        >
          {t("backToToday")}
        </button>
      )}
    </div>
  );
}
