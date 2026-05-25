"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { unlockReport, type UnlockReportState } from "@/lib/data/actions";

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

export function UnlockForm({ reportId }: { reportId: string }) {
  const t = useTranslations("Office");
  const [state, action, pending] = useActionState<UnlockReportState, FormData>(
    unlockReport,
    undefined,
  );

  if (state && "ok" in state) {
    return (
      <p className="text-sm text-green-600">{t("unlockSuccess")}</p>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="report_id" value={reportId} />
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t("unlockReason")}</span>
        <input
          type="text"
          name="unlock_reason"
          required
          placeholder={t("unlockReasonPlaceholder")}
          className={inputClass}
        />
      </label>
      {state && "error" in state && (
        <p className="text-sm text-red-600">{t("unlockError")}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-black/20 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-white/25"
      >
        {pending ? t("unlocking") : t("unlockSubmit")}
      </button>
    </form>
  );
}
