import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getOpenIssues } from "@/lib/data/reports";
import { listProfiles } from "@/lib/auth/dal";
import { assignIssue, setIssueResolved } from "@/lib/data/actions";
import { todayISO } from "@/lib/date";

const inputCls =
  "rounded-lg border border-black/20 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/25 dark:focus:border-white/50";
const btnCls =
  "rounded-lg border border-black/20 px-3 py-1 text-xs font-medium dark:border-white/25";

// Whole days between the report date and today (MYT). ISO strings parsed as UTC
// midnight so the day count is timezone-stable.
function ageDays(dateISO: string): number {
  const then = new Date(`${dateISO}T00:00:00Z`).getTime();
  const now = new Date(`${todayISO()}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((now - then) / 86_400_000));
}

// Aging colour: 7d+ red, 3d+ amber, else neutral.
function ageClass(days: number): string {
  if (days >= 7) return "text-red-600 dark:text-red-400 font-semibold";
  if (days >= 3) return "text-amber-600 dark:text-amber-400 font-medium";
  return "text-black/50 dark:text-white/50";
}

export default async function OfficeIssuesPage() {
  const ti = await getTranslations("Issues");
  const tr = await getTranslations("Report");
  const [issues, profiles] = await Promise.all([getOpenIssues(), listProfiles()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{ti("title")}</h1>
        <p className="text-sm text-black/60 dark:text-white/60">{ti("intro")}</p>
      </div>

      {issues.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">{ti("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {issues.map((iss) => {
            const days = ageDays(iss.report_date);
            return (
              <li
                key={iss.id}
                className="space-y-2 rounded-xl border border-black/10 p-4 text-sm dark:border-white/15"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{iss.description}</p>
                    <div className="mt-0.5 text-xs text-black/60 dark:text-white/60">
                      <span className="rounded-full bg-black/5 px-2 py-0.5 dark:bg-white/10">
                        {tr(`cat.${iss.category}`)}
                      </span>
                      {iss.project_name && (
                        <Link
                          href={`/office/projects/${iss.project_id}/reports/${iss.report_id}`}
                          className="ml-2 underline"
                        >
                          {iss.project_name}
                        </Link>
                      )}
                      <span className="ml-2">{iss.report_date}</span>
                    </div>
                  </div>
                  <p className={`shrink-0 text-xs ${ageClass(days)}`}>
                    {ti("ageDays", { days })}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <form action={assignIssue} className="flex items-center gap-1">
                    <input type="hidden" name="issue_id" value={iss.id} />
                    <input type="hidden" name="project_id" value={iss.project_id} />
                    <input type="hidden" name="report_id" value={iss.report_id} />
                    <select
                      name="assigned_to"
                      defaultValue={iss.assigned_to ?? ""}
                      className={inputCls}
                    >
                      <option value="">{ti("unassigned")}</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.username}
                        </option>
                      ))}
                    </select>
                    <button className={btnCls}>{ti("assign")}</button>
                  </form>
                  <form action={setIssueResolved}>
                    <input type="hidden" name="issue_id" value={iss.id} />
                    <input type="hidden" name="project_id" value={iss.project_id} />
                    <input type="hidden" name="report_id" value={iss.report_id} />
                    <input type="hidden" name="resolved" value="1" />
                    <button className={`${btnCls} text-green-700 dark:text-green-400`}>
                      {ti("close")}
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
