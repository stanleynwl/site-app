import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { getReportsInRange } from "@/lib/data/reports";
import { getProjectPhotos, withSignedPhotoUrls } from "@/lib/data/photos";
import {
  getProjectPurchaseRequests,
  prMaterialName,
  prAgeHours,
  PR_OPEN_STATUSES,
} from "@/lib/data/purchase-requests";
import {
  getProjectDeliveries,
  deliveryMaterialName,
  deliveryVariance,
} from "@/lib/data/deliveries";
import { todayISO, daysAgoISO } from "@/lib/date";
import { PrintButton } from "@/components/print-button";

const AUDIENCES = ["consultant", "client", "boss"] as const;
type Audience = (typeof AUDIENCES)[number];

const thCls = "border border-black/30 px-2 py-1 text-left font-semibold";
const tdCls = "border border-black/20 px-2 py-1 align-top";

export default async function ExportPrintPage({
  searchParams,
}: {
  searchParams: Promise<{
    project?: string;
    audience?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const sp = await searchParams;
  const projectId = sp.project ?? "";
  if (!projectId) notFound();
  const project = await getProject(projectId);
  if (!project) notFound();

  const audience: Audience = AUDIENCES.includes(sp.audience as Audience)
    ? (sp.audience as Audience)
    : "consultant";
  const to = sp.to || todayISO();
  const from = sp.from || daysAgoISO(29);

  const te = await getTranslations("Export");
  const tp = await getTranslations("Pdf");

  const titleByAudience: Record<Audience, string> = {
    consultant: te("consultantTitle"),
    client: te("clientTitle"),
    boss: te("bossTitle"),
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 text-black">
      <div className="no-print flex items-center justify-between">
        <Link
          href="/office/export"
          className="text-sm text-black/50 underline dark:text-white/60"
        >
          ← {te("title")}
        </Link>
        <PrintButton />
      </div>

      <article className="space-y-5 rounded-lg border border-black/15 bg-white p-8 text-sm leading-relaxed text-black print:border-0 print:p-0">
        <header className="border-b border-black/20 pb-3">
          <h1 className="text-lg font-bold">{project.name}</h1>
          <p className="text-black/60">
            {[project.code, project.location].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-2 font-semibold">{titleByAudience[audience]}</p>
          <p className="text-black/60">{te("range", { from, to })}</p>
        </header>

        {audience === "consultant" && (
          <Consultant projectId={projectId} from={from} to={to} />
        )}
        {audience === "client" && (
          <ClientReport projectId={projectId} from={from} to={to} />
        )}
        {audience === "boss" && (
          <Boss projectId={projectId} from={from} to={to} />
        )}

        <footer className="border-t border-black/20 pt-3 text-xs text-black/50">
          {tp("generated", { date: todayISO() })}
        </footer>
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

// Consultant — EOT evidence: per-day weather/rain/manpower + a delays list.
async function Consultant({
  projectId,
  from,
  to,
}: {
  projectId: string;
  from: string;
  to: string;
}) {
  const te = await getTranslations("Export");
  const tr = await getTranslations("Report");
  const reports = await getReportsInRange(projectId, from, to);
  const workersOf = (r: (typeof reports)[number]) =>
    r.manpower_entries.reduce((s, m) => s + (m.worker_count ?? 0), 0);
  const totalRain = reports.reduce((s, r) => s + (r.rain_hours ?? 0), 0);
  const totalManDays = reports.reduce((s, r) => s + workersOf(r), 0);
  const rainDays = reports.filter((r) => (r.rain_hours ?? 0) > 0).length;
  const delays = reports.flatMap((r) =>
    r.issues.map((i) => ({ date: r.report_date, issue: i })),
  );

  if (reports.length === 0) {
    return <p className="text-black/60">{te("noData")}</p>;
  }

  return (
    <div className="space-y-5">
      <p className="text-black/80">
        {te("summary", {
          days: reports.length,
          manDays: totalManDays,
          rain: Number(totalRain.toFixed(1)),
          rainDays,
        })}
      </p>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={thCls}>{te("colDate")}</th>
            <th className={thCls}>{te("colWeather")}</th>
            <th className={thCls}>{te("colRain")}</th>
            <th className={thCls}>{te("colWorkers")}</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.id}>
              <td className={tdCls}>{r.report_date}</td>
              <td className={tdCls}>
                {r.report_type === "no_work"
                  ? tr("reportType.no_work")
                  : r.weather
                    ? tr(`weatherOpt.${r.weather}`)
                    : "—"}
              </td>
              <td className={tdCls}>{r.rain_hours ?? 0}</td>
              <td className={tdCls}>{workersOf(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Section title={te("delays")}>
        {delays.length === 0 ? (
          <p className="text-black/60">{te("none")}</p>
        ) : (
          <ul className="ml-4 list-disc">
            {delays.map(({ date, issue }) => (
              <li key={issue.id}>
                {date}: {issue.description} [{tr(`cat.${issue.category}`)}]
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

// Client — progress narrative + photos.
async function ClientReport({
  projectId,
  from,
  to,
}: {
  projectId: string;
  from: string;
  to: string;
}) {
  const te = await getTranslations("Export");
  const [reports, allPhotos] = await Promise.all([
    getReportsInRange(projectId, from, to),
    getProjectPhotos(projectId),
  ]);
  const inRange = allPhotos.filter((p) => {
    const d = (p.taken_at ?? p.created_at).slice(0, 10);
    return d >= from && d <= to;
  });
  const photos = await withSignedPhotoUrls(inRange);
  const narrative = reports.filter((r) => r.work_done);

  return (
    <div className="space-y-5">
      <Section title={te("workNarrative")}>
        {narrative.length === 0 ? (
          <p className="text-black/60">{te("noData")}</p>
        ) : (
          <ul className="space-y-2">
            {narrative.map((r) => (
              <li key={r.id}>
                <span className="font-medium">{r.report_date}</span>
                <span className="whitespace-pre-wrap text-black/80">
                  {" "}
                  — {r.work_done}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={te("photos")}>
        {photos.length === 0 ? (
          <p className="text-black/60">{te("noPhotos")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) =>
              p.url ? (
                <figure key={p.id} className="space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.caption ?? ""}
                    className="aspect-square w-full rounded border border-black/15 object-cover"
                  />
                  <figcaption className="text-xs text-black/60">
                    {p.caption ? `${p.caption} · ` : ""}
                    {(p.taken_at ?? p.created_at).slice(0, 10)}
                    {p.tags.length > 0
                      ? ` · ${p.tags.map((t) => t.label).join(", ")}`
                      : ""}
                  </figcaption>
                </figure>
              ) : null,
            )}
          </div>
        )}
      </Section>
    </div>
  );
}

// Boss — exceptions only: overdue requests, delivery variances, open issues.
async function Boss({
  projectId,
  from,
  to,
}: {
  projectId: string;
  from: string;
  to: string;
}) {
  const te = await getTranslations("Export");
  const tr = await getTranslations("Report");
  const td = await getTranslations("Deliveries");
  const treq = await getTranslations("Requests");
  const [requests, deliveries, reports] = await Promise.all([
    getProjectPurchaseRequests(projectId),
    getProjectDeliveries(projectId),
    getReportsInRange(projectId, from, to),
  ]);

  const openRequests = requests
    .filter((r) => PR_OPEN_STATUSES.includes(r.status))
    .map((r) => ({ r, age: prAgeHours(r) }))
    .sort((a, b) => b.age - a.age);

  const variances = deliveries
    .map((d) => ({ d, v: deliveryVariance(d) }))
    .filter((x) => x.v != null && x.v !== 0);

  const openIssues = reports.flatMap((r) =>
    r.issues
      .filter((i) => !i.resolved)
      .map((i) => ({ date: r.report_date, issue: i })),
  );

  const nothing =
    openRequests.length === 0 &&
    variances.length === 0 &&
    openIssues.length === 0;

  if (nothing) {
    return <p className="text-black/70">{te("noExceptions")}</p>;
  }

  return (
    <div className="space-y-5">
      <Section title={te("openRequests")}>
        {openRequests.length === 0 ? (
          <p className="text-black/60">{te("none")}</p>
        ) : (
          <ul className="ml-4 list-disc">
            {openRequests.map(({ r, age }) => (
              <li key={r.id}>
                {prMaterialName(r)}
                {r.quantity != null ? ` (${r.quantity}${r.unit ? ` ${r.unit}` : ""})` : ""}
                {" — "}
                {treq(`status.${r.status}`)}
                <span className={age >= 48 ? "font-semibold text-red-700" : ""}>
                  {" · "}
                  {te("waiting", { hours: age })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={te("variances")}>
        {variances.length === 0 ? (
          <p className="text-black/60">{te("none")}</p>
        ) : (
          <ul className="ml-4 list-disc">
            {variances.map(({ d, v }) => (
              <li key={d.id}>
                {deliveryMaterialName(d)}
                {d.delivered_on ? ` (${d.delivered_on})` : ""}: {td("doQuantity")}{" "}
                {d.do_quantity ?? "—"} · {td("received")} {d.received_quantity ?? "—"} ·{" "}
                <span className="font-semibold">
                  {td("variance")} {v}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={te("openIssues")}>
        {openIssues.length === 0 ? (
          <p className="text-black/60">{te("none")}</p>
        ) : (
          <ul className="ml-4 list-disc">
            {openIssues.map(({ date, issue }) => (
              <li key={issue.id}>
                {date}: {issue.description} [{tr(`cat.${issue.category}`)}]
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
