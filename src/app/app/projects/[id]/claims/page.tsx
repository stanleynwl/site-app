import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { getSubcontractors } from "@/lib/data/workers";
import { getSiteClaims, getClaimPhotos, claimTotal } from "@/lib/data/claims";
import { verifyClaim, approveClaim } from "@/lib/data/actions";
import { getProfile } from "@/lib/auth/dal";
import { ClaimStatusChip, ClaimStamps } from "@/components/claim-status";

// Site surface for the claim workflow: office sends a keyed claim (with photos
// of the paper original) here; the supervisor verifies the work is real; a PM
// gives final approval.

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function SiteClaimsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const t = await getTranslations("Claims");
  const [claims, subs, profile] = await Promise.all([
    getSiteClaims(id),
    getSubcontractors(),
    getProfile(),
  ]);
  const photosByClaim = await getClaimPhotos(claims.map((c) => c.id));
  const subName = new Map(subs.map((s) => [s.id, s.name]));
  const canApprove = profile?.role === "pm" || profile?.is_admin;

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/app/projects/${id}`} className="text-xs underline">
          ← {project.name}
        </Link>
        <h1 className="mt-1 text-lg font-semibold">{t("siteTitle")}</h1>
        <p className="text-xs text-black/70 dark:text-white/70">{t("siteIntro")}</p>
      </div>

      {claims.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">{t("siteEmpty")}</p>
      ) : (
        claims.map((claim) => {
          const photos = photosByClaim.get(claim.id) ?? [];
          return (
            <section
              key={claim.id}
              className="rounded-xl border border-black/10 p-4 dark:border-white/15"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">
                    {subName.get(claim.subcontractor_id) ?? "—"}
                  </h2>
                  <p className="text-xs text-black/60 dark:text-white/60">
                    {claim.period_month.slice(0, 7)}
                  </p>
                </div>
                <ClaimStatusChip status={claim.status} />
              </div>

              {claim.items.length > 0 ? (
                <>
                  <table className="mt-3 w-full border-collapse text-sm">
                    <thead>
                      <tr className="text-left text-xs text-black/60 dark:text-white/60">
                        <th className="py-1 pr-2 font-medium">{t("description")}</th>
                        <th className="w-20 py-1 px-2 text-right font-medium">{t("qty")}</th>
                        <th className="w-16 py-1 px-2 font-medium">{t("unit")}</th>
                        <th className="w-24 py-1 px-2 text-right font-medium">{t("unitPrice")}</th>
                        <th className="w-24 py-1 pl-2 text-right font-medium">{t("amount")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {claim.items.map((it) => (
                        <tr key={it.id} className="border-t border-black/10 dark:border-white/10">
                          <td className="py-1.5 pr-2">{it.description}</td>
                          <td className="px-2 text-right">{it.quantity}</td>
                          <td className="px-2">{it.unit ?? ""}</td>
                          <td className="px-2 text-right">{money(it.unit_price)}</td>
                          <td className="pl-2 text-right">{money(it.quantity * it.unit_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-2 flex items-center justify-between text-sm">
                    {claim.note ? (
                      <p className="text-black/60 dark:text-white/60">
                        {t("note")}: {claim.note}
                      </p>
                    ) : (
                      <span />
                    )}
                    <p className="font-semibold">
                      {t("total")}: {money(claimTotal(claim))}
                    </p>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-black/60 dark:text-white/60">
                  {t("seeAttached")}
                  {claim.note ? ` · ${claim.note}` : ""}
                </p>
              )}

              {photos.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {photos.map((p) =>
                    p.url && p.storage_path.endsWith(".pdf") ? (
                      <a
                        key={p.id}
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-24 w-24 flex-col items-center justify-center rounded-lg border border-black/10 text-xs font-medium underline dark:border-white/15"
                      >
                        📄 PDF
                      </a>
                    ) : p.url ? (
                      <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt=""
                          className="h-24 w-24 rounded-lg border border-black/10 object-cover dark:border-white/15"
                        />
                      </a>
                    ) : null,
                  )}
                </div>
              )}

              <ClaimStamps claim={claim} />

              <div className="mt-3 flex gap-2">
                {claim.status === "submitted" && (
                  <form action={verifyClaim}>
                    <input type="hidden" name="claim_id" value={claim.id} />
                    <input type="hidden" name="project_id" value={id} />
                    <button className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background">
                      {t("verify")}
                    </button>
                  </form>
                )}
                {claim.status === "verified" && canApprove && (
                  <form action={approveClaim}>
                    <input type="hidden" name="claim_id" value={claim.id} />
                    <input type="hidden" name="project_id" value={id} />
                    <button className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background">
                      {t("approve")}
                    </button>
                  </form>
                )}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
