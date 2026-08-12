import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { getSuppliers } from "@/lib/data/catalog";
import {
  getPurchaseOrder,
  getCompanyForProject,
  poItemName,
  poLineTotal,
  poSubtotal,
  poTax,
  poTotal,
  poLabel,
  poNeededBy,
  type PurchaseOrder,
  type PurchaseOrderItem,
} from "@/lib/data/purchase-orders";
import {
  savePurchaseOrder,
  issuePurchaseOrder,
  revisePurchaseOrder,
  cancelPurchaseOrder,
} from "@/lib/data/actions";
import { PrintButton } from "@/components/export-buttons";

// One purchase order: an editable draft, or — once issued — the document of
// record. The document markup is shared by both states; only the line table
// swaps between inputs and text, so what office edits is exactly what prints.

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BLANK_ROWS = 4;
const cellInput =
  "w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-accent";

const CHIP: Record<string, string> = {
  draft: "bg-black/10 text-black/70 dark:bg-white/15 dark:text-white/70",
  issued: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    dateStyle: "medium",
  }).format(new Date(iso));
}

// Where "← back" goes. The list that linked here passes its own URL, filters and
// all, so returning doesn't throw away a search. Must be a local office path —
// never trust an arbitrary URL from the query string as a link target.
function safeBackHref(back: string | undefined, fallback: string): string {
  if (!back) return fallback;
  const decoded = decodeURIComponent(back);
  return decoded.startsWith("/office/") && !decoded.startsWith("//") ? decoded : fallback;
}

export default async function PurchaseOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ poId: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { poId } = await params;
  const { back } = await searchParams;
  const po = await getPurchaseOrder(poId);
  if (!po) notFound();

  const t = await getTranslations("Po");
  const [project, company, suppliers] = await Promise.all([
    getProject(po.project_id),
    getCompanyForProject(po.project_id),
    getSuppliers(),
  ]);
  const activeSuppliers = suppliers.filter((s) => s.active);
  const editable = po.status === "draft";
  const backHref = safeBackHref(back, `/office/projects/${po.project_id}/purchase-orders`);

  return (
    <div className="space-y-5">
      <style>{`@media print { @page { margin: 14mm } }`}</style>

      {/* Toolbar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={backHref} className="text-xs text-muted hover:underline">
            ← {t("backToList")}
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold">
            {poLabel(po)}
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                CHIP[po.status] ?? CHIP.draft
              }`}
            >
              {t(`status.${po.status}`)}
            </span>
          </h1>
          {po.source === "local" && (
            <p className="text-xs text-muted">{t("fromLocal")}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrintButton label={t("print")} />
          {po.status === "issued" && (
            <form action={revisePurchaseOrder}>
              <input type="hidden" name="po_id" value={po.id} />
              <input type="hidden" name="project_id" value={po.project_id} />
              <button className="btn">{t("revise")}</button>
            </form>
          )}
          {po.status !== "cancelled" && (
            <form action={cancelPurchaseOrder}>
              <input type="hidden" name="po_id" value={po.id} />
              <input type="hidden" name="project_id" value={po.project_id} />
              <button className="btn text-red-600">{t("cancel")}</button>
            </form>
          )}
        </div>
      </div>

      {/* The document */}
      <div className="card space-y-5 p-6">
        {/* Letterhead */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="text-lg font-semibold">{company?.name ?? "—"}</p>
            {company?.registration_no && (
              <p className="text-xs text-muted">({company.registration_no})</p>
            )}
            {company?.address && (
              <p className="whitespace-pre-line text-xs text-muted">{company.address}</p>
            )}
            <p className="text-xs text-muted">
              {[company?.phone, company?.email].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">
              {po.doc_type === "memo" ? t("memoTitle") : t("title")}
            </p>
            <p className="text-sm font-medium">{poLabel(po)}</p>
            <p className="text-xs text-muted">
              {/* doc_date is the document's own date and may be backdated —
                  prefer it over when the row happened to be created. */}
              {t("dated")}:{" "}
              {po.doc_date
                ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
                    new Date(`${po.doc_date}T00:00:00`),
                  )
                : fmtDate(po.issued_at ?? po.created_at)}
            </p>
            {po.parent_po_number && (
              <p className="text-xs text-muted">
                {t("against")}: {po.parent_po_number}
              </p>
            )}
            {po.is_bulk && <p className="text-xs text-muted">{t("bulkOrder")}</p>}
          </div>
        </div>

        {editable ? (
          <EditableOrder
            po={po}
            suppliers={activeSuppliers}
            projectName={project?.name ?? ""}
            t={t}
          />
        ) : (
          <ReadOnlyOrder po={po} projectName={project?.name ?? ""} t={t} />
        )}

        {/* Signature / issued-by */}
        <div className="border-t border-border pt-4 text-sm">
          {po.issued_at ? (
            <p className="text-green-800 dark:text-green-300">
              ✓{" "}
              {t("issuedStamp", {
                name: po.issued_by_name ?? "—",
                date: fmtDate(po.issued_at),
              })}
            </p>
          ) : (
            <p className="text-xs text-muted">{t("notIssuedYet")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Totals({
  po,
  t,
}: {
  po: PurchaseOrder;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <div className="ml-auto w-64 space-y-1 text-sm">
      <div className="flex justify-between text-muted">
        <span>{t("subtotal")}</span>
        <span className="text-foreground">{money(poSubtotal(po))}</span>
      </div>
      <div className="flex justify-between text-muted">
        <span>
          {t("tax")} ({po.tax_percent}%)
        </span>
        <span className="text-foreground">{money(poTax(po))}</span>
      </div>
      <div className="flex justify-between border-t border-border pt-1 text-base font-semibold">
        <span>{t("total")}</span>
        <span>{money(poTotal(po))}</span>
      </div>
    </div>
  );
}

function PartyBlocks({
  po,
  projectName,
  t,
}: {
  po: PurchaseOrder;
  projectName: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <h3 className="text-xs font-medium text-muted">{t("toSupplier")}</h3>
        <p className="font-medium">{po.supplier?.name ?? "—"}</p>
        {po.supplier?.address && (
          <p className="whitespace-pre-line text-sm text-muted">{po.supplier.address}</p>
        )}
        <p className="text-sm text-muted">
          {[po.supplier?.phone, po.supplier?.email].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div>
        <h3 className="text-xs font-medium text-muted">{t("deliverTo")}</h3>
        <p className="font-medium">{projectName}</p>
        {po.delivery_address && (
          <p className="whitespace-pre-line text-sm text-muted">{po.delivery_address}</p>
        )}
        {poNeededBy(po) && (
          <p className="text-sm text-muted">
            {t("neededBy")}: {poNeededBy(po)}
          </p>
        )}
        {po.site_contact && (
          <p className="text-sm text-muted">
            {t("siteContact")}: {po.site_contact}
          </p>
        )}
      </div>
    </div>
  );
}

function EditableOrder({
  po,
  suppliers,
  projectName,
  t,
}: {
  po: PurchaseOrder;
  suppliers: { id: string; name: string }[];
  projectName: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const rows: (PurchaseOrderItem | null)[] = [
    ...po.items,
    ...Array.from({ length: BLANK_ROWS }, () => null),
  ];

  return (
    <form action={savePurchaseOrder} className="space-y-4">
      <input type="hidden" name="po_id" value={po.id} />
      <input type="hidden" name="project_id" value={po.project_id} />

      {/* Header fields — editing controls hidden on the printout, which shows
          the same values through PartyBlocks below. */}
      <div className="no-print grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted">{t("supplier")}</span>
          <select
            name="supplier_id"
            defaultValue={po.supplier_id ?? ""}
            className={cellInput}
          >
            <option value="">—</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted">{t("neededBy")}</span>
          <input
            type="date"
            name="needed_by"
            defaultValue={po.needed_by ?? ""}
            className={cellInput}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted">{t("deliveryAddress")}</span>
          <input
            name="delivery_address"
            defaultValue={po.delivery_address ?? ""}
            className={cellInput}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted">{t("taxPercent")}</span>
          <input
            type="number"
            step="any"
            min="0"
            name="tax_percent"
            defaultValue={po.tax_percent}
            className={cellInput}
          />
        </label>
      </div>

      <div className="hidden print:block">
        <PartyBlocks po={po} projectName={projectName} t={t} />
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-1 pr-2 font-medium">{t("item")}</th>
            <th className="w-32 py-1 px-2 font-medium">{t("spec")}</th>
            <th className="w-20 py-1 px-2 font-medium">{t("qty")}</th>
            <th className="w-20 py-1 px-2 font-medium">{t("unit")}</th>
            <th className="w-28 py-1 px-2 font-medium">{t("unitPrice")}</th>
            <th className="w-28 py-1 pl-2 text-right font-medium">{t("amount")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((it, i) => (
            <tr key={it?.id ?? `blank-${i}`}>
              <td className="py-1 pr-2">
                <input type="hidden" name="item_material_id" value={it?.material_id ?? ""} />
                <input
                  name="item_name"
                  defaultValue={it ? poItemName(it) : ""}
                  placeholder={t("itemHint")}
                  className={cellInput}
                />
              </td>
              <td className="px-2">
                <input name="item_spec" defaultValue={it?.spec ?? ""} className={cellInput} />
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
                <input name="item_unit" defaultValue={it?.unit ?? ""} className={cellInput} />
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
                {it ? money(poLineTotal(it)) : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Totals po={po} t={t} />

      <div className="no-print grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted">{t("terms")}</span>
          <input name="terms" defaultValue={po.terms ?? ""} className={cellInput} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted">{t("note")}</span>
          <input name="note" defaultValue={po.note ?? ""} className={cellInput} />
        </label>
      </div>

      {/* Both buttons submit this form; Issue overrides the action via
          formAction (a nested <form> would be invalid HTML). The hidden
          po_id / project_id above are all issuePurchaseOrder needs. */}
      <div className="no-print space-y-2">
        <p className="text-xs text-muted">{t("issueHint")}</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-accent">{t("save")}</button>
          <button className="btn" formAction={issuePurchaseOrder}>
            {t("issue")}
          </button>
        </div>
      </div>
    </form>
  );
}

function ReadOnlyOrder({
  po,
  projectName,
  t,
}: {
  po: PurchaseOrder;
  projectName: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <div className="space-y-4">
      <PartyBlocks po={po} projectName={projectName} t={t} />

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-1 pr-2 font-medium">{t("item")}</th>
            <th className="py-1 px-2 font-medium">{t("spec")}</th>
            <th className="w-20 py-1 px-2 text-right font-medium">{t("qty")}</th>
            <th className="w-20 py-1 px-2 font-medium">{t("unit")}</th>
            <th className="w-28 py-1 px-2 text-right font-medium">{t("unitPrice")}</th>
            <th className="w-28 py-1 pl-2 text-right font-medium">{t("amount")}</th>
          </tr>
        </thead>
        <tbody>
          {po.items.map((it) => (
            <tr key={it.id} className="border-t border-border">
              <td className="py-1.5 pr-2">{poItemName(it)}</td>
              <td className="px-2 text-muted">{it.spec ?? ""}</td>
              <td className="px-2 text-right">{it.quantity}</td>
              <td className="px-2">{it.unit ?? ""}</td>
              <td className="px-2 text-right">{money(it.unit_price)}</td>
              <td className="pl-2 text-right">{money(poLineTotal(it))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Totals po={po} t={t} />

      {(po.terms || po.supplier?.payment_terms) && (
        <p className="text-sm text-muted">
          {t("terms")}: {po.terms ?? po.supplier?.payment_terms}
        </p>
      )}
      {po.remark && (
        <p className="text-sm text-muted">
          {t("remark")}: {po.remark}
        </p>
      )}
      {po.note && <p className="whitespace-pre-line text-sm text-muted">{po.note}</p>}
    </div>
  );
}
