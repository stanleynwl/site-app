import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { getWorkers, getSubcontractors } from "@/lib/data/workers";
import { getAttendanceForDate } from "@/lib/data/attendance";
import { saveAttendance, createWorker, createAdvance } from "@/lib/data/actions";
import {
  todayISO,
  daysAgoISO,
  normalizeReportDate,
  MAX_BACKDATE_DAYS,
} from "@/lib/date";
import { ReportDateNav } from "@/components/report-date-nav";

const baseInput =
  "rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

export default async function WorkersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const { date: dateParam } = await searchParams;
  const project = await getProject(id);
  if (!project) notFound();

  const t = await getTranslations("Workers");
  const today = todayISO();
  const selectedDate = (dateParam && normalizeReportDate(dateParam)) || today;

  const [workers, subs, attendance] = await Promise.all([
    getWorkers(),
    getSubcontractors(),
    getAttendanceForDate(id, selectedDate),
  ]);
  const activeWorkers = workers.filter((w) => w.active);
  const activeSubs = subs.filter((s) => s.active);
  const subName = new Map(subs.map((s) => [s.id, s.name]));
  const unitsByWorker = new Map(
    attendance.filter((a) => a.worker_id).map((a) => [a.worker_id as string, a.units]),
  );

  // Group active workers: own (in-house) first, then each subcontractor.
  const groups: { key: string; label: string; workers: typeof activeWorkers }[] = [];
  const own = activeWorkers.filter((w) => !w.subcontractor_id);
  if (own.length) groups.push({ key: "own", label: t("own"), workers: own });
  for (const s of activeSubs) {
    const ws = activeWorkers.filter((w) => w.subcontractor_id === s.id);
    if (ws.length) groups.push({ key: s.id, label: s.name, workers: ws });
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/app/projects/${id}`}
          className="text-xs text-muted hover:underline"
        >
          ← {project.name}
        </Link>
        <h1 className="mt-1 text-lg font-semibold">{t("title")}</h1>
        <p className="text-xs text-muted">{t("intro")}</p>
      </div>

      <ReportDateNav
        date={selectedDate}
        today={today}
        minDate={daysAgoISO(MAX_BACKDATE_DAYS)}
      />

      {/* Daily attendance — units per worker (blank = absent) */}
      <form action={saveAttendance} className="space-y-4">
        <input type="hidden" name="project_id" value={id} />
        <input type="hidden" name="work_date" value={selectedDate} />

        {groups.length === 0 ? (
          <p className="card border-dashed p-6 text-center text-sm text-muted">
            {t("noWorkers")}
          </p>
        ) : (
          groups.map((g) => (
            <section key={g.key} className="space-y-2">
              <p className="section-title">{g.label}</p>
              <ul className="card divide-y divide-border">
                {g.workers.map((w) => (
                  <li key={w.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <input type="hidden" name="att_worker_id" value={w.id} />
                    <span className="flex-1">{w.name}</span>
                    <input
                      name="att_units"
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      min="0"
                      defaultValue={unitsByWorker.get(w.id) ?? ""}
                      placeholder={t("units")}
                      aria-label={`${w.name} ${t("units")}`}
                      className={`${baseInput} w-24 text-right`}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        {/* Ad-hoc worker not yet on the roster */}
        <div className="card flex flex-wrap items-end gap-2 p-4">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">{t("adhocName")}</label>
            <input
              name="adhoc_name"
              placeholder={t("adhocHint")}
              className={`${baseInput} w-full`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">{t("units")}</label>
            <input
              name="adhoc_units"
              type="number"
              step="0.5"
              min="0"
              className={`${baseInput} w-24 text-right`}
            />
          </div>
        </div>

        <button className="btn btn-accent btn-lg w-full">{t("save")}</button>
      </form>

      {/* Add a worker to the roster (any member) */}
      <details className="card p-4">
        <summary className="cursor-pointer select-none text-sm font-medium">
          {t("addWorker")}
        </summary>
        <form action={createWorker} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="project_id" value={id} />
          <label className="text-sm">
            <span className="mb-1 block">{t("name")}</span>
            <input name="name" required className={`${baseInput} w-full`} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block">{t("belongsTo")}</span>
            <select name="subcontractor_id" defaultValue="" className={`${baseInput} w-full`}>
              <option value="">{t("own")}</option>
              {activeSubs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <button className="btn">{t("addWorker")}</button>
          </div>
        </form>
      </details>

      {/* Log an advance (支款) to a worker or a subcontractor */}
      <details className="card p-4">
        <summary className="cursor-pointer select-none text-sm font-medium">
          {t("logAdvance")}
        </summary>
        <form action={createAdvance} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="project_id" value={id} />
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block">{t("advanceTo")}</span>
            <select name="target" defaultValue="" required className={`${baseInput} w-full`}>
              <option value="" disabled>
                {t("advanceTo")}
              </option>
              {activeWorkers.length > 0 && (
                <optgroup label={t("workersGroup")}>
                  {activeWorkers.map((w) => (
                    <option key={w.id} value={`worker:${w.id}`}>
                      {w.name}
                      {w.subcontractor_id
                        ? ` (${subName.get(w.subcontractor_id) ?? ""})`
                        : ""}
                    </option>
                  ))}
                </optgroup>
              )}
              {activeSubs.length > 0 && (
                <optgroup label={t("subsGroup")}>
                  {activeSubs.map((s) => (
                    <option key={s.id} value={`sub:${s.id}`}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block">{t("amount")}</span>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required
              className={`${baseInput} w-full`}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block">{t("date")}</span>
            <input
              name="advance_date"
              type="date"
              defaultValue={selectedDate}
              className={`${baseInput} w-full`}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block">{t("note")}</span>
            <input name="note" className={`${baseInput} w-full`} />
          </label>
          <div className="sm:col-span-2">
            <button className="btn">{t("logAdvance")}</button>
          </div>
        </form>
      </details>
    </div>
  );
}
