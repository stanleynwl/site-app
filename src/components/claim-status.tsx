import { getTranslations } from "next-intl/server";
import type { Claim } from "@/lib/data/claims";

// Status chip + verified/approved stamp lines shared by the office claims page
// and the site claims page. Names come from the columns stamped by the
// verify/approve RPCs (a profiles join would be blocked by RLS).

const CHIP: Record<string, string> = {
  draft: "bg-black/10 text-black/70 dark:bg-white/15 dark:text-white/70",
  submitted: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  verified: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300",
};

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    dateStyle: "medium",
  }).format(new Date(iso));
}

export async function ClaimStatusChip({ status }: { status: string }) {
  const t = await getTranslations("Claims");
  const key =
    status === "submitted"
      ? "statusSubmitted"
      : status === "verified"
        ? "statusVerified"
        : status === "approved"
          ? "statusApproved"
          : "statusDraft";
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CHIP[status] ?? CHIP.draft}`}
    >
      {t(key)}
    </span>
  );
}

export async function ClaimStamps({ claim }: { claim: Claim }) {
  const t = await getTranslations("Claims");
  if (!claim.verified_at && !claim.approved_at) return null;
  return (
    <div className="mt-3 space-y-0.5 text-sm">
      {claim.verified_at && (
        <p className="text-sky-800 dark:text-sky-300">
          ✓{" "}
          {t("verifiedStamp", {
            name: claim.verified_by_name ?? "—",
            date: fmtDate(claim.verified_at),
          })}
        </p>
      )}
      {claim.approved_at && (
        <p className="text-green-800 dark:text-green-300">
          ✓{" "}
          {t("approvedStamp", {
            name: claim.approved_by_name ?? "—",
            date: fmtDate(claim.approved_at),
          })}
        </p>
      )}
    </div>
  );
}
