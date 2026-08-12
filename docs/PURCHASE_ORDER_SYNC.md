# Purchase orders — web ⇄ local office app sync contract

**Added:** migration `0038_purchase_orders.sql`
**Decision (Stanley, 2026-08-11):** Supabase is the **single source of truth** for PO
records. Both the web app and the local office app read and write the same rows.

Before this, procurement in the web app was capture-only: `purchase_requests.po_number`
was free text an office user typed in, and the PO document itself was produced by the
local app, which kept its own numbering (`PO-4718`, `PO-4715 Rev 1`) in its own store.
Nothing was shared. Now both sides use the tables below.

---

## Tables

### `purchase_orders`

| Column | Notes |
|---|---|
| `po_number` | **unique.** Always minted by `next_po_number()` — never generated locally |
| `revision` | `0` = original. `1+` renders as "Rev N", matching the local app's labelling |
| `project_id` | FK `projects` |
| `supplier_id` | FK `suppliers` (nullable) |
| `purchase_request_id` | FK `purchase_requests` — set when the PO came from a site request |
| `status` | `draft` → `issued` → `cancelled` |
| `needed_by`, `delivery_address`, `terms`, `note` | Document fields |
| `tax_percent` | Percentage; the total is computed, never stored (Design Principle #3) |
| `source` | `'web'` or `'local'` — which system created the row |
| `issued_at`, `issued_by`, `issued_by_name` | Stamped on issue |

### `purchase_order_items`

`po_id`, `material_id` (nullable FK `materials`), `material_text`, `spec`,
`quantity`, `unit`, `unit_price`, `sort_order`.

Line and order totals are **derived, never stored** — `poSubtotal` / `poTax` /
`poTotal` in `src/lib/data/purchase-orders.ts`.

---

## Rule 1 — never mint a PO number locally

```sql
select public.next_po_number();   -- returns e.g. 'PO-4719'
```

Backed by the `po_number_seq` sequence, so the two systems physically cannot
collide. `purchase_orders.po_number` also has a unique constraint as a backstop.

**Before the local app issues its first PO through Supabase**, set the sequence past
the highest number it has already used locally:

```sql
select setval('public.po_number_seq', 4718);   -- highest existing local PO
```

The migration starts the sequence at `4719` based on `PO-4718` being the highest
seen. If the local app has gone further since, run the `setval` above with the real
maximum — otherwise the first web PO will collide and the insert will be rejected.

## Rule 2 — write with `source = 'local'`

So a row's origin stays visible when reconciling. The web sets `'web'`; both are
shown identically in the UI, with a "Created in the local office app" note on
local rows.

## Rule 3 — `po_number` is the shared key

Match on `po_number`, not on `id` (a uuid the local app has no reason to know).
Revisions keep the same `po_number` and bump `revision` — the supplier already has
the number, so a corrected order is `Rev 1`, never a new number.

## Rule 4 — the local app connects with the service-role key

Same as the archive script. RLS on these tables is project-membership + office-flag
based, which a background process has no session for; the service role bypasses it.

> **The service-role key must never appear in the Vercel web app** — see CLAUDE.md.
> It belongs only in the local app / scripts, from `.env.local`.

---

## Web-side flow (for reference)

1. Office opens `/office/requests` and clicks **Create PO** on a request →
   `createPurchaseOrderFromRequest` mints a number, copies the request's line items
   at `unit_price = 0`, and redirects to the PO editor.
2. `/office/purchase-orders/<id>` — office keys prices, supplier, terms, tax, then
   **Save draft**.
3. **Issue PO** → status `issued`, stamps `issued_by_name`, and mirrors
   `po_number` + `status = 'po_issued'` back onto the originating
   `purchase_requests` row so the existing request → delivery flow is unchanged.
4. Print (browser "Save as PDF") produces the document — the same zero-dependency
   approach as the other exports.
5. **Revise** on an issued PO reopens it as a draft and bumps `revision`.

A PO created in the local app appears in the web list automatically — same table,
no import step.

---

## Status: both directions are live (2026-08-12)

**Backfill — done.** All 14 POs and 43 line items that existed in the local app
were imported by `npm run import-pos` (`scripts/import-local-pos.mjs`). Re-run it
any time; it upserts on `po_number`, so it only ever adds or refreshes.

**Ongoing — automatic.** `siteapp-office/src/lib/po-sync.ts` (`pushPoRecord`) pushes
the PO record on issue, called from `writeback.ts`, which previously only stamped
`po_number` onto the request. Covers memos and blank POs too. No import step for
new orders.

**Numbering — self-healing.** `sync_po_sequence()` is called after every push and
after every import.

> **Numbering incident worth remembering.** 0038 seeded `po_number_seq` from the
> highest PO number then visible (4718), but the local app had already reached
> 4725 — so the first web PO would have been `PO-4719`, a number already given to
> a supplier. Caught before any web PO was created. This is why the sequence is
> now derived from the table rather than set by hand.
