import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getMyProjects } from "@/lib/data/projects";
import { getSubcontractors } from "@/lib/data/workers";
import { getAllClaims, claimTotal } from "@/lib/data/claims";
import { ClaimStatusChip } from "@/components/claim-status";

// Office overview: every claim across projects, newest month first. Each row
// links into the project's claims page (where keying/photos/send live).

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function OfficeClaimsOverviewPage() {
  const tc = await getTranslations("Claims");
  const [claims, projects, subs] = await Promise.all([
    getAllClaims(),
    getMyProjects(),
    getSubcontractors(),
  ]);
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const subName = new Map(subs.map((s) => [s.id, s.name]));

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{tc("title")}</h1>
        <p className="text-xs text-muted">{tc("allIntro")}</p>
      </div>

      {claims.length === 0 ? (
        <p className="text-sm text-muted">{tc("noneYet")}</p>
      ) : (
        <ul className="divide-y divide-black/10 rounded-xl border border-black/10 text-sm dark:divide-white/10 dark:border-white/15">
          {claims.map((c) => {
            const month = c.period_month.slice(0, 7);
            const total = claimTotal(c);
            return (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <Link
                    href={`/office/projects/${c.project_id}/claims?month=${month}`}
                    className="font-medium hover:underline"
                  >
                    {subName.get(c.subcontractor_id) ?? "—"}
                  </Link>
                  <span className="ml-2 text-xs text-muted">
                    {projectName.get(c.project_id) ?? ""} · {month}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {total > 0 && (
                    <span className="text-xs tabular-nums text-muted">RM {money(total)}</span>
                  )}
                  <ClaimStatusChip status={c.status} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
