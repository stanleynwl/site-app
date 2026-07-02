import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import {
  itemName,
  daysBetween,
  prIsOverdue,
  type PurchaseRequest,
} from "@/lib/data/purchase-requests";
import {
  getProcurementView,
  mytDate,
  mytDateTime,
} from "@/lib/data/materials-register";
import { todayISO } from "@/lib/date";
import { FilterChips, SearchBox } from "@/components/filter-chips";
import type { FilterOption } from "@/components/filter-chips";
import { MaterialsCsvButton } from "@/components/materials-csv-button";

// Office Materials Procurement Register: a permanent, dated archive of every
// purchase request and its request→order→delivery timeline. Read-only; filters
// live in the URL (server-rendered). CSV + Print-to-PDF for the file.
export default async function MaterialsRegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const project = await getProject(id);
  if (!project) notFound();

  const t = await getTranslations("Materials");
  const treq = await getTranslations("Requests");
  const today = todayISO();

  const { filtered, summary, months, suppliers } = await getProcurementView(id, {
    month: sp.month,
    status: sp.status,
    supplier: sp.supplier,
    q: sp.q,
  });

  const monthOptions: FilterOption[] = months.map((m) => ({ label: m, value: m }));
  const statusOptions: FilterOption[] = [
    { label: t("overdue"), value: "overdue" },
    { label: treq("status.pending"), value: "pending" },
    { label: treq("status.approved"), value: "approved" },
    { label: treq("status.po_issued"), value: "po_issued" },
    { label: treq("status.partial"), value: "partial" },
    { label: treq("status.delivered"), value: "delivered" },
  ];
  const supplierOptions: FilterOption[] = suppliers.map((s) => ({ label: s, value: s }));

  // Flatten to one CSV line per item for a spreadsheet-friendly register.
  const csvHeaders = [
    t("colRequested"),
    t("colMaterial"),
    t("colQty"),
    t("colUnit"),
    t("colSpec"),
    t("colStatus"),
    t("colOrdered"),
    t("colPo"),
    t("colSupplier"),
    t("colNeededBy"),
    t("colDelivered"),
    t("colLeadDays"),
  ];
  const csvRows: string[][] = filtered.flatMap((r) =>
    (r.items.length ? r.items : [null]).map((it) => [
      mytDateTime(r.created_at),
      it ? itemName(it) : "—",
      it?.quantity != null ? String(it.quantity) : "",
      it?.unit ?? "",
      it?.spec ?? "",
      treq(`status.${r.status}`),
      mytDate(r.ordered_at),
      r.po_number ?? "",
      r.supplier?.name ?? "",
      r.needed_by ?? "",
      mytDate(r.delivered_at),
      daysBetween(r.created_at, r.delivered_at)?.toString() ?? "",
    ]),
  );

  const qs = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => v) as [string, string][],
  ).toString();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/office/projects/${id}`}
          className="text-xs text-black/50 hover:underline dark:text-white/50"
        >
          ← {project.name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-black/50 dark:text-white/50">{t("intro")}</p>
      </div>

      {/* Summary header — the "future reference" snapshot */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label={t("statTotal")} value={summary.total} />
        <Stat label={t("statDelivered")} value={summary.delivered} />
        <Stat label={t("statOutstanding")} value={summary.outstanding} />
        <Stat
          label={t("statOverdue")}
          value={summary.overdue}
          tone={summary.overdue > 0 ? "bad" : undefined}
        />
        <Stat
          label={t("statReqToOrder")}
          value={summary.avgRequestToOrderDays ?? "—"}
          suffix={summary.avgRequestToOrderDays != null ? t("daysSuffix") : ""}
        />
        <Stat
          label={t("statOrderToDeliver")}
          value={summary.avgOrderToDeliveryDays ?? "—"}
          suffix={summary.avgOrderToDeliveryDays != null ? t("daysSuffix") : ""}
        />
      </div>

      {/* Filters */}
      <Suspense>
        <div className="space-y-3 rounded-xl border border-black/10 p-3 dark:border-white/15">
          <SearchBox paramKey="q" placeholder={t("searchPlaceholder")} />
          {monthOptions.length > 1 && (
            <FilterChips paramKey="month" options={monthOptions} label={t("filterMonth")} allLabel={t("filterAll")} />
          )}
          <FilterChips paramKey="status" options={statusOptions} label={t("filterStatus")} allLabel={t("filterAll")} />
          {supplierOptions.length > 0 && (
            <FilterChips paramKey="supplier" options={supplierOptions} label={t("filterSupplier")} allLabel={t("filterAll")} />
          )}
        </div>
      </Suspense>

      {/* Export row */}
      <div className="flex items-center gap-2">
        <MaterialsCsvButton
          filename={`materials-${project.code || project.name}-${today}.csv`}
          headers={csvHeaders}
          rows={csvRows}
        />
        <Link
          href={`/office/projects/${id}/materials/print${qs ? `?${qs}` : ""}`}
          className="rounded-lg border border-black/20 px-3 py-1 text-xs font-medium dark:border-white/25"
        >
          {t("printRegister")}
        </Link>
      </div>

      {/* Register list */}
      {filtered.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => (
            <RegisterCard key={r.id} r={r} today={today} t={t} treq={treq} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  tone?: "bad";
}) {
  return (
    <div className="rounded-xl border border-black/10 px-3 py-2 dark:border-white/15">
      <div
        className={`text-lg font-semibold ${
          tone === "bad" ? "text-red-600 dark:text-red-400" : ""
        }`}
      >
        {value}
        {suffix ? <span className="text-xs font-normal"> {suffix}</span> : null}
      </div>
      <div className="text-[11px] text-black/50 dark:text-white/50">{label}</div>
    </div>
  );
}

function RegisterCard({
  r,
  today,
  t,
  treq,
}: {
  r: PurchaseRequest;
  today: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
  treq: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const overdue = prIsOverdue(r, today);
  const lead = daysBetween(r.created_at, r.delivered_at);

  return (
    <li className="space-y-2 rounded-xl border border-black/10 p-4 text-sm dark:border-white/15">
      <div className="flex items-start justify-between gap-3">
        <ul className="flex-1 space-y-0.5">
          {r.items.map((it) => (
            <li key={it.id}>
              <span className="font-medium">{itemName(it)}</span>
              {it.quantity != null && (
                <span className="text-black/60 dark:text-white/60">
                  {" · "}
                  {it.delivered_quantity != null
                    ? `${it.delivered_quantity} / `
                    : ""}
                  {it.quantity}
                  {it.unit ? ` ${it.unit}` : ""}
                </span>
              )}
              {it.spec && (
                <span className="text-black/50 dark:text-white/50"> — {it.spec}</span>
              )}
            </li>
          ))}
        </ul>
        <div className="shrink-0 text-right">
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
            {treq(`status.${r.status}`)}
          </span>
          {overdue && (
            <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
              {t("overdue")}
            </p>
          )}
        </div>
      </div>

      {/* Dated timeline: Requested → Ordered → Delivered */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-black/70 dark:text-white/70">
        <Step label={t("requested")} value={mytDateTime(r.created_at)} />
        <span className="text-black/30">→</span>
        <Step
          label={t("ordered")}
          value={
            r.ordered_at
              ? `${mytDate(r.ordered_at)}${r.po_number ? ` · PO ${r.po_number}` : ""}${
                  r.supplier?.name ? ` · ${r.supplier.name}` : ""
                }`
              : "—"
          }
        />
        <span className="text-black/30">→</span>
        <Step label={t("delivered")} value={mytDate(r.delivered_at)} />
        {lead != null && (
          <span className="text-black/50 dark:text-white/50">
            · {t("leadDays", { days: lead })}
          </span>
        )}
      </div>

      {(r.needed_by || r.note) && (
        <div className="text-xs text-black/50 dark:text-white/50">
          {r.needed_by ? `${t("colNeededBy")}: ${r.needed_by}` : ""}
          {r.needed_by && r.note ? " · " : ""}
          {r.note ?? ""}
        </div>
      )}
    </li>
  );
}

function Step({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-black/40 dark:text-white/40">{label} </span>
      {value}
    </span>
  );
}
