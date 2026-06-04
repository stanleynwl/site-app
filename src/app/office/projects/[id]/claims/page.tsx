import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { getSubcontractors } from "@/lib/data/workers";
import { getProjectClaims, claimTotal, type ClaimItem } from "@/lib/data/claims";
import { getAdvances, currentMonthMYT } from "@/lib/data/attendance";
import { saveClaim } from "@/lib/data/actions";
import { PrintButton } from "@/components/export-buttons";

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BLANK_ROWS = 6;
const cellInput =
  "w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-accent";

export default async function OfficeClaimsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { id } = await params;
  const { month: monthParam } = await searchParams;
  const project = await getProject(id);
  if (!project) notFound();

  const tc = await getTranslations("Claims");
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthMYT();

  const [subs, claims, advances] = await Promise.all([
    getSubcontractors(),
    getProjectClaims(id, month),
    getAdvances(id, month),
  ]);
  const activeSubs = subs.filter((s) => s.active);
  const claimBySub = new Map(claims.map((c) => [c.subcontractor_id, c]));
  const subAdvance = new Map<string, number>();
  for (const a of advances) {
    if (a.subcontractor_id)
      subAdvance.set(a.subcontractor_id, (subAdvance.get(a.subcontractor_id) ?? 0) + a.amount);
  }

  return (
    <div className="space-y-6">
      <style>{`@media print { @page { margin: 14mm } }`}</style>

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/office/projects/${id}`} className="text-xs text-muted hover:underline">
            ← {project.name}
          </Link>
          <h1 className="mt-1 text-xl font-semibold">{tc("title")}</h1>
          <p className="text-xs text-muted">{tc("intro")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/office/projects/${id}/claims?month=${shiftMonth(month, -1)}`} className="btn">
            ‹
          </Link>
          <span className="min-w-24 text-center text-sm font-medium">{month}</span>
          <Link href={`/office/projects/${id}/claims?month=${shiftMonth(month, 1)}`} className="btn">
            ›
          </Link>
          <PrintButton label={tc("print")} />
        </div>
      </div>

      <h2 className="hidden text-lg font-semibold print:block">
        {project.name} — {tc("title")} {month}
      </h2>

      {activeSubs.length === 0 ? (
        <p className="text-sm text-muted">{tc("noSubs")}</p>
      ) : (
        activeSubs.map((s) => {
          const claim = claimBySub.get(s.id);
          const items = claim?.items ?? [];
          const rows: (ClaimItem | null)[] = [
            ...items,
            ...Array.from({ length: BLANK_ROWS }, () => null),
          ];
          const total = claim ? claimTotal(claim) : 0;
          const adv = subAdvance.get(s.id) ?? 0;
          const net = total - adv;

          return (
            <section key={s.id} className="card p-5">
              <h2 className="text-base font-semibold">{s.name}</h2>

              <form action={saveClaim} className="mt-3 space-y-3">
                <input type="hidden" name="project_id" value={id} />
                <input type="hidden" name="subcontractor_id" value={s.id} />
                <input type="hidden" name="month" value={month} />

                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="py-1 pr-2 font-medium">{tc("description")}</th>
                      <th className="w-24 py-1 px-2 font-medium">{tc("qty")}</th>
                      <th className="w-20 py-1 px-2 font-medium">{tc("unit")}</th>
                      <th className="w-28 py-1 px-2 font-medium">{tc("unitPrice")}</th>
                      <th className="w-28 py-1 pl-2 text-right font-medium">{tc("amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((it, i) => (
                      <tr key={it?.id ?? `blank-${i}`}>
                        <td className="py-1 pr-2">
                          <input
                            name="item_description"
                            defaultValue={it?.description ?? ""}
                            placeholder={tc("descHint")}
                            className={cellInput}
                          />
                        </td>
                        <td className="px-2">
                          <input
                            name="item_quantity"
                            type="number"
                            step="any"
                            min="0"
                            defaultValue={it?.quantity ?? ""}
                            className={`${cellInput} text-right`}
                          />
                        </td>
                        <td className="px-2">
                          <input
                            name="item_unit"
                            defaultValue={it?.unit ?? ""}
                            className={cellInput}
                          />
                        </td>
                        <td className="px-2">
                          <input
                            name="item_unit_price"
                            type="number"
                            step="any"
                            min="0"
                            defaultValue={it?.unit_price ?? ""}
                            className={`${cellInput} text-right`}
                          />
                        </td>
                        <td className="pl-2 text-right text-muted">
                          {it ? money(it.quantity * it.unit_price) : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex flex-wrap items-end justify-between gap-3">
                  <label className="flex-1 text-sm">
                    <span className="mb-1 block text-xs text-muted">{tc("note")}</span>
                    <input
                      name="note"
                      defaultValue={claim?.note ?? ""}
                      className={`${cellInput} max-w-md`}
                    />
                  </label>
                  <div className="text-right text-sm">
                    <div className="text-muted">
                      {tc("total")}: <span className="font-medium text-foreground">{money(total)}</span>
                    </div>
                    <div className="text-muted">
                      {tc("lessAdvance")}: <span className="text-foreground">{money(adv)}</span>
                    </div>
                    <div className="mt-1 text-base font-semibold">
                      {tc("netPayable")}: {money(net)}
                    </div>
                  </div>
                </div>

                <button className="btn btn-accent no-print">{tc("save")}</button>
              </form>
            </section>
          );
        })
      )}
    </div>
  );
}
