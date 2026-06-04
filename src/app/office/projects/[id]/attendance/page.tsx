import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { getWorkers, getSubcontractors } from "@/lib/data/workers";
import {
  getMonthAttendance,
  getAdvances,
  daysInMonth,
  currentMonthMYT,
} from "@/lib/data/attendance";
import { deleteAdvance } from "@/lib/data/actions";
import { PrintButton, CsvButton } from "@/components/export-buttons";

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const unit = (n: number | "") => (n === "" || n === 0 ? "" : String(n));

type Row = {
  name: string;
  group: string;
  cells: (number | "")[];
  total: number;
  advance: number;
};

export default async function OfficeAttendancePage({
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

  const tw = await getTranslations("Attendance");
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthMYT();

  const [workers, subs, attendance, advances] = await Promise.all([
    getWorkers(),
    getSubcontractors(),
    getMonthAttendance(id, month),
    getAdvances(id, month),
  ]);

  const days = daysInMonth(month);
  const dayNums = Array.from({ length: days }, (_, i) => i + 1);

  // units by worker|day and ad-hoc-name -> day -> units
  const unitMap = new Map<string, number>();
  const adhoc = new Map<string, Map<number, number>>();
  for (const a of attendance) {
    const d = Number(a.work_date.slice(8, 10));
    if (a.worker_id) {
      unitMap.set(`${a.worker_id}|${d}`, (unitMap.get(`${a.worker_id}|${d}`) ?? 0) + a.units);
    } else if (a.worker_name) {
      const m = adhoc.get(a.worker_name) ?? new Map<number, number>();
      m.set(d, (m.get(d) ?? 0) + a.units);
      adhoc.set(a.worker_name, m);
    }
  }
  const workerAdvance = new Map<string, number>();
  const subAdvance = new Map<string, number>();
  for (const adv of advances) {
    if (adv.worker_id)
      workerAdvance.set(adv.worker_id, (workerAdvance.get(adv.worker_id) ?? 0) + adv.amount);
    if (adv.subcontractor_id)
      subAdvance.set(adv.subcontractor_id, (subAdvance.get(adv.subcontractor_id) ?? 0) + adv.amount);
  }

  const workerTotal = (wid: string) =>
    dayNums.reduce((s, d) => s + (unitMap.get(`${wid}|${d}`) ?? 0), 0);

  // Ordered groups: own, each subcontractor, then ad-hoc "others".
  const order: { key: string; label: string; sub?: boolean }[] = [
    { key: "own", label: tw("own") },
    ...subs.map((s) => ({ key: s.id, label: s.name, sub: true })),
    { key: "__others__", label: tw("others") },
  ];

  const rows: Row[] = [];
  for (const w of workers) {
    if (workerTotal(w.id) === 0) continue; // only workers who worked this month
    const cells = dayNums.map((d) => unitMap.get(`${w.id}|${d}`) ?? ("" as const));
    rows.push({
      name: w.name,
      group: w.subcontractor_id ?? "own",
      cells,
      total: workerTotal(w.id),
      advance: workerAdvance.get(w.id) ?? 0,
    });
  }
  for (const [name, m] of adhoc) {
    const cells = dayNums.map((d) => m.get(d) ?? ("" as const));
    const total = dayNums.reduce((s, d) => s + (m.get(d) ?? 0), 0);
    rows.push({ name, group: "__others__", cells, total, advance: 0 });
  }

  // CSV (server-prepared) -----------------------------------------------------
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csvRows: (string | number)[][] = [
    [tw("worker"), tw("group"), ...dayNums.map(String), tw("total"), tw("advance")],
  ];
  for (const g of order) {
    for (const r of rows.filter((x) => x.group === g.key)) {
      csvRows.push([
        r.name,
        g.label,
        ...r.cells.map((c) => (c === "" ? "" : c)),
        r.total,
        r.advance || "",
      ]);
    }
  }
  const csv = csvRows.map((r) => r.map(esc).join(",")).join("\n");

  const th = "border border-border px-1.5 py-1 text-center text-[11px] font-medium";
  const td = "border border-border px-1.5 py-1 text-center text-[11px]";

  return (
    <div className="space-y-4">
      <style>{`@media print { @page { size: A4 landscape; margin: 10mm } }`}</style>

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/office/projects/${id}`} className="text-xs text-muted hover:underline">
            ← {project.name}
          </Link>
          <h1 className="mt-1 text-xl font-semibold">{tw("title")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/office/projects/${id}/attendance?month=${shiftMonth(month, -1)}`} className="btn">
            ‹
          </Link>
          <span className="min-w-24 text-center text-sm font-medium">{month}</span>
          <Link href={`/office/projects/${id}/attendance?month=${shiftMonth(month, 1)}`} className="btn">
            ›
          </Link>
          <CsvButton csv={csv} filename={`attendance_${project.name}_${month}.csv`} label={tw("csv")} />
          <PrintButton label={tw("print")} />
        </div>
      </div>

      <h2 className="hidden text-lg font-semibold print:block">
        {project.name} — {tw("title")} {month}
      </h2>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">{tw("empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="border-collapse">
            <thead>
              <tr>
                <th className={`${th} sticky left-0 bg-surface text-left`}>{tw("worker")}</th>
                {dayNums.map((d) => (
                  <th key={d} className={th}>
                    {d}
                  </th>
                ))}
                <th className={th}>{tw("total")}</th>
                <th className={th}>{tw("advance")}</th>
              </tr>
            </thead>
            <tbody>
              {order.map((g) => {
                const grows = rows.filter((r) => r.group === g.key);
                const sa = g.sub ? subAdvance.get(g.key) ?? 0 : 0;
                if (grows.length === 0 && sa === 0) return null;
                return (
                  <Fragment key={g.key}>
                    <tr>
                      <td
                        colSpan={dayNums.length + 3}
                        className="border border-border bg-surface-2 px-2 py-1 text-left text-[11px] font-semibold"
                      >
                        {g.label}
                        {g.sub ? ` · ${tw("paidByClaim")}` : ""}
                      </td>
                    </tr>
                    {grows.map((r) => (
                      <tr key={`${g.key}-${r.name}`}>
                        <td className={`${td} sticky left-0 bg-surface text-left font-medium`}>
                          {r.name}
                        </td>
                        {r.cells.map((c, i) => (
                          <td key={i} className={td}>
                            {unit(c)}
                          </td>
                        ))}
                        <td className={`${td} font-semibold`}>{r.total || ""}</td>
                        <td className={td}>{r.advance ? money(r.advance) : ""}</td>
                      </tr>
                    ))}
                    {g.sub && sa > 0 && (
                      <tr>
                        <td
                          colSpan={dayNums.length + 2}
                          className="border border-border px-2 py-1 text-right text-[11px] text-muted"
                        >
                          {tw("subAdvance")}
                        </td>
                        <td className={`${td} text-muted`}>{money(sa)}</td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Advances ledger for the month (with delete) */}
      {advances.length > 0 && (
        <section className="no-print space-y-2">
          <h2 className="section-title">{tw("advancesThisMonth")}</h2>
          <ul className="card divide-y divide-border text-sm">
            {advances.map((adv) => {
              const who = adv.worker_id
                ? workers.find((w) => w.id === adv.worker_id)?.name
                : subs.find((s) => s.id === adv.subcontractor_id)?.name;
              return (
                <li key={adv.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span>
                    <span className="font-medium">{who ?? "—"}</span>
                    <span className="text-muted">
                      {" "}
                      · {adv.advance_date} · {money(adv.amount)}
                      {adv.note ? ` · ${adv.note}` : ""}
                    </span>
                  </span>
                  <form action={deleteAdvance}>
                    <input type="hidden" name="advance_id" value={adv.id} />
                    <input type="hidden" name="project_id" value={id} />
                    <button className="text-xs text-danger hover:underline">{tw("remove")}</button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
