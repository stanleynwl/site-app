@AGENTS.md

# SiteApp — Claude session context

Full design doc: `docs/STATUS_ADDENDUM.md`. Read it before any non-trivial work.

## Stack (locked)
Next.js 16 (Turbopack) · TypeScript · Tailwind v4 · Supabase · Vercel · PWA (@serwist/turbopack)
Repo lives at `D:\dev\site-app` (moved off the E: external drive — running the dev server from E: was painfully slow). Pushed to private GitHub `stanleynwl/site-app`.

## Critical Next.js 16 notes
- Middleware renamed to **Proxy** (`src/proxy.ts`). `redirectTo()` helper copies session cookies onto redirect responses.
- `cookies()` is async.
- Docs at `node_modules/next/dist/docs/` — training data is stale, read these first.
- **next-intl:** root `layout.tsx` MUST pass `locale` + `messages` explicitly to `<NextIntlClientProvider>` (`await getMessages()`). The no-props auto-inherit form is flaky under Turbopack and throws intermittent "No intl context found" 500s on client components.

## Supabase gotchas (learned the hard way)
- **Table GRANTs are separate from RLS.** RLS policies alone aren't enough — the `authenticated`/`anon` roles also need table/sequence GRANTs or you get `permission denied for table …` (this caused an ERR_TOO_MANY_REDIRECTS loop via a failing profile read). Fixed in migration `0004`; every later migration re-grants. `getProfile` uses `.maybeSingle()`.
- **Don't hand-edit auth tables.** Create users via the dashboard Auth UI. The "Incorrect username or password" bug was the **Email provider being disabled** — enable it, disable "Confirm email".
- **PostgREST embed ambiguity (PGRST201):** when >1 FK links two tables, name the FK in the select, e.g. `photos!photos_delivery_id_fkey(...)` (deliveries↔photos have two FKs: `photos.delivery_id` and `deliveries.do_photo_id`).

## Trades localization
Default manpower trades stored canonically (English), displayed per-locale. Canonical↔key map: `src/lib/trades.ts` (`DEFAULT_TRADES`, `defaultTradeKey`). Labels: `Report.trades.<key>` in all 3 message files. Always store canonical, translate for display. 0-worker default rows dropped on save.

## Auth
Username + password. Synthetic emails: `username@siteapp.local`. No public sign-up. Create users manually in Supabase dashboard. See `supabase/README.md`.

## i18n
next-intl v4 without routing. Locale via `locale` cookie. Messages: `src/messages/{en,ms,zh}.json`. All user-visible strings must be i18n'd in all three locales.

## Phase status
- **Phase 0:** ✅ Done.
- **Phase 1:** ✅ e2e VERIFIED 2026-05-25.
- **Phase 2:** ✅ Built — catalog, deliveries (three-quantity), photo-first capture, delete, photo archive, photo taxonomy + progress photos.
- **Phase 3 (offline sync / PowerSync):** ⏸ not started — needs a PowerSync account + deps (external setup), deferred.
- **Phase 4 (purchase requests):** ✅ Built — **multi-item** (header + line items), type-to-search material picker, and the **Accepted → Ordered** office flow with **site Confirm-delivered**. 0009 applied; **migrations `0014` (line items) + `0015` (member update RLS) PENDING.**
- **Phase 5 (operations):** ✅ Built — machinery (daily-report section) + weekly stock counts + visitors (daily-report section). Equipment is covered by machinery's "Other" row. **Migrations `0011`, `0012`, `0013` PENDING.**
- **Phase 6 (PDF export):** ✅ Built 2026-05-27 — per-report print-to-PDF **and** three-audience date-range exports (consultant EOT / client progress+photos / boss exceptions) at `/office/export`. Zero deps, no migration.
- **Phase 7 (pilot):** not started.

## Phase 1 (done)
- **Soft-edit window:** Author can edit submitted report for 15 min. Edits logged to `report_edits`. PMs can unlock after hard-lock with a reason (sets status back to `draft`).
- **`no_work` report type:** `report_type` enum `normal | no_work`. When `no_work`, capture `no_work_reason` (`holiday | weather | site_closed | other`), hide manpower + work_done.
- **Pre-fill policy (explicit in code):** manpower YES · equipment YES (future) · weather NO · visitors NO · work_done NEVER · notes NEVER.
- **Default manpower trades:** fresh report pre-fills General worker, Carpenter, Bar bender, Bricklayer, Plasterer (0 each). "Subcontractor" column removed (too cramped on phone).
- **Backdated / missed-day reports:** `?date=` param + `report-date-nav.tsx` picker (today−14..today); `saveReport` validates via `normalizeReportDate`, sets `is_backdated`; amber banner in capture, "Backdated" badge in office.

## Phase 2 (in progress)
- **Suppliers = managed list** (not free-text). Catalog UI at `/office/catalog` (pm/office). Data: `src/lib/data/catalog.ts`; actions `createSupplier`/`createMaterial` + **`updateSupplier`/`updateMaterial` (inline edit) + `setSupplierActive`/`setMaterialActive` (deactivate hides from pickers; no hard delete — avoids the stock_counts cascade)**. Materials have `count_required`. Pickers filter `active`.
- **Deliveries — three-quantity model + photo-first capture.** Supervisor fast path at `/app/projects/[id]/deliveries`: snap photo(s) + tap an issue chip (broken/missing/short/wrong_item/late/other) + optional note; supplier/material/qty optional (collapsible "Add details"). Office fills supplier/material + `do_quantity` from the photo on `/office/projects/[id]`, sees thumbnails + variance. Photos compressed client-side (canvas ~1600px/0.8), uploaded to private Storage bucket `site-photos` at `photos/{YYYY-MM}/{project_id}/{uuid}.jpg`, served via signed URLs. `requested_quantity` null until Phase 4 (purchase requests).
- **Delete delivery** (office, pm/office): `deleteDelivery` purges Storage files + photo rows, then the delivery.
- **Photo taxonomy + progress photos.** Per-project tags (`project_tags`, kind = block/level/area/activity, `approved` flag). Supervisor captures **progress photos** at `/app/projects/[id]/photos` (`progress-photo-form.tsx`, reuses `PhotoCapture`) with caption + tag chips, and can **suggest** new tags (approved=false). Office manages the taxonomy (add=approved, approve pending, delete) and re-tags photos on `/office/projects/[id]`. Progress photos = `photos` rows with `delivery_id IS NULL`. Data: `tags.ts` + `photos.ts` (`getProjectPhotos`/`withSignedPhotoUrls`); pure constants in `tag-kinds.ts` (client-safe, since `tags.ts` is `server-only`). Actions: `createProjectTag`/`approveProjectTag`/`deleteProjectTag`/`createPhoto`/`setPhotoTags`. No migration needed (tables existed in 0006).

## Key file map
- `src/lib/data/reports.ts` — report types + read queries
- `src/lib/data/actions.ts` — Server Actions (saveReport, unlockReport, createProject, createSupplier, createMaterial, createDelivery, setDeliveryOfficeFields, deleteDelivery)
- `src/lib/data/deliveries.ts` — Delivery types + reads; `withSignedUrls` (skips archived), `deliveryVariance`, `deliveryMaterialName`
- `src/lib/data/catalog.ts` — suppliers/materials reads
- `src/components/daily-report-form.tsx` — supervisor capture form
- `src/components/delivery-form.tsx` — photo-first delivery capture
- `src/components/photo-capture.tsx` — camera input + canvas compress + Storage upload
- `src/components/delete-delivery-button.tsx`, `report-date-nav.tsx`
- `src/lib/date.ts` — tz helpers, soft-edit window, `MAX_BACKDATE_DAYS=14`, `normalizeReportDate`
- `src/lib/trades.ts` — canonical↔key trade map
- `supabase/migrations/` — 0001 init · 0002 projects+reports · 0003 soft-edit+no_work · 0004 grants · 0005 backdated · 0006 Phase 2 schema · 0007 delivery issues+`photos.delivery_id` · 0008 `photos.archived_at`
- `supabase/storage_setup.sql` — `site-photos` bucket + storage RLS

## Phase 4 (purchase requests — multi-item)
Capture-only procurement. A request is a **header** (needed-by / urgency / note / status / supplier / PO#) with **one or more line items** (`purchase_request_items`: material catalog-or-free-text + qty + unit) — so site can order several materials from one supplier in a single request (timber 1x2 + timber 2x3…). Supervisor raises at `/app/projects/[id]/requests` (`purchase-request-form.tsx` → `request-items-field.tsx`, a **type-to-search** material combobox per row: filters the catalog as you type, tap to pick → sets material_id + unit, or leave as free text). Office works the queue at `/office/requests` (nav "Requests"): open requests across projects, oldest first, **aging colour** (24h amber / 48h red), each request showing its item list. State machine `pending → approved → po_issued → delivered → closed` (+ `rejected`); actions `approve/reject/issuePurchaseRequestPO(captures PO#)/close`. **Loop-closer:** office links a delivery to a request **item** (`setDeliveryOfficeFields` + `purchase_request_item_id` select) → copies that item's qty into `deliveries.requested_quantity`. Data: `purchase-requests.ts` (`PurchaseRequestItem`, `itemName`, `prItemsLabel`). Migrations: `0009` (request header + enum + `deliveries.purchase_request_id` FK), `0014` (line items + `deliveries.purchase_request_item_id` + backfills existing single-material requests into one item each), `0015` (relax purchase_requests UPDATE RLS to project members so a supervisor can confirm delivery).

**Status labels + lifecycle (relabeled 2026-05-27):** enum values unchanged in DB; displayed as `approved`→**Accepted**, `po_issued`→**Ordered**. Office buttons: Accept / Reject / **Order** (captures PO#) / Close. **Site flow:** the supervisor's `/app/projects/[id]/requests` list shows only live requests (`pending`/`approved`/`po_issued`) — **rejected drops off**; when a request is **Ordered** the supervisor gets a **Confirm delivered** button (`confirmDeliveredPurchaseRequest`, member-allowed via 0015, only `po_issued`→`delivered`) and once confirmed it leaves their list too (delivered/closed hidden on site).

## Phase 5 (operations — built, migrations pending)
**Machinery (in the daily report).** Per Stanley (2026-05-27), machinery is a **section of the daily report** like manpower — NOT a standalone page (the 0010 standalone feature was removed). One `machinery_entries` row = one machine + hours; repeat a type for multiple units (backhoe 8h + backhoe 4h when one broke down). Default types excavator/backhoe/backpusher (canonical English stored, localized via `Report.machineTypes.<key>`; `src/lib/machines.ts` mirrors `trades.ts`) + "Other" free-text. UI in `daily-report-form.tsx` (machinery section, mirrors manpower, controlled rows w/ a type `<select>` + hours); persisted by `saveReport` (delete+insert, drops 0-hour rows; normal reports only); shown in the office report view + the read-only locked view; pre-fills from yesterday like manpower. Migration `0012_machinery_in_report.sql` adds `machinery_entries` (RLS mirrors manpower_entries) and **drops the obsolete `machines`/`machine_logs` tables from 0010**.

**Weekly stock counts.** Supervisor records a physical count of a catalog material on a date at `/app/projects/[id]/stock` (`stock-count-form.tsx`, upsert on project+material+date). **Consumption is DERIVED, never stored** (Design Principle #3): per material, `consumption = previous_count + deliveries_in_(prev,latest] − latest_count`, where a delivery contributes `received_quantity ?? do_quantity` and only catalog-material (`material_id`) deliveries match. Computed in `getStockSummary` (stock.ts). Office project page + supervisor stock page show on-hand latest + derived "used since" per material. Action `recordStockCount`. Migration `0011_stock_counts.sql`. **Remaining Phase 5: visitors/equipment as secondary fields on the daily report.**

## Migrations
**Applied through 0013 + storage_setup on hosted Supabase (0009–0013 applied 2026-05-27). PENDING apply: `0014` (purchase_request_items + `deliveries.purchase_request_item_id`), `0015` (relax purchase_requests UPDATE RLS to members).**

## Phase 6 PDF export (print-to-PDF, zero deps)
Zero-dependency approach throughout (deliberately avoided puppeteer/@react-pdf for Vercel simplicity): clean print-optimized pages + browser "Save as PDF" via `PrintButton` (`window.print()`). `globals.css` `@media print` forces light, hides the office `aside` + `.no-print`, sets margins.
- **Per-report:** `/office/projects/[id]/reports/[reportId]/print` — one daily report (manpower/machinery/visitors/issues/work-done/notes). Linked from the office report view.
- **Three-audience date-range exports:** `/office/export` (nav "PDF export", now a real page) → `export-form.tsx` (project + from/to + audience) → `/office/export/print?project=&audience=&from=&to=`. Templates in that print page (async server sub-components, each calls its own `getTranslations`):
  - **consultant** (EOT evidence): per-day weather/rain/workers table + totals (rain hours, man-days) + delays/issues list. Uses `getReportsInRange`.
  - **client** (progress): per-day work-done narrative + progress-photo grid (signed URLs, filtered to range).
  - **boss** (exceptions): open/overdue purchase requests (aged, 48h+ red), delivery variances (`deliveryVariance != 0`), unresolved issues. "No exceptions" when clean.
- Data helper added: `getReportsInRange(projectId, from, to)` in reports.ts. i18n `Export` + `Pdf` namespaces. **Future:** true one-click server-side PDF if browser-print isn't enough.

## Visitors (daily-report section)
Optional secondary section on the daily report (like issues, shown for all report types): name + purpose. **No pre-fill** (policy). `visitor_entries` table (migration `0013`, RLS mirrors manpower). Persisted in `saveReport` (outside the normal-only block, so it saves on no-work days too). Shown in the office report view + locked read-only view. i18n `Report.visitors`/`visitorName`/`visitorPurpose`.

## Photo archive (policy revised 2026-05-27)
`scripts/archive-photos.mjs` (`npm run archive`). Downloads photos to a local archive dir (mirrors `photos/{YYYY-MM}/...`), verifies, deletes the file from Storage, marks `photos.archived_at` (keeps the row). **Grace = 3 working days (Mon–Sat; Sundays don't count, Malaysia time)** before a photo is archived — recent photos stay visible for the office; tune via `GRACE_WORKING_DAYS`. **Also saves full metadata offline:** a sidecar `<file>.json` per photo (complete photo row + joined delivery record: supplier/material/project/qty/DO#/issue/note) + a run manifest, so the local archive is self-contained. The script **never deletes metadata** — rows are deleted only manually on Stanley's request. `withSignedUrls` skips archived photos. **Consequence: the app only shows photos captured since the previous run** — review/key-in recent deliveries before running. Needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (gitignored); optional `SITEAPP_ARCHIVE_DIR` (default `../siteapp-archive`). Scheduled biweekly via Windows Task Scheduler ("SiteApp Photo Archive"; Stanley moving it to Mon 10 PM w/ `-StartWhenAvailable`). See `scripts/README_archive.md`. Storage stays on Supabase for now; Cloudflare R2 (10 GB free, zero egress) is the documented fallback if the 1 GB free tier is outgrown.

## Deferred features (unscheduled — needs Stanley's placement decision)
### Claims submission (site → office)
Known claim types: **manpower monthly workdone card** (monthly summary of direct-labour work done) and **subcontractor claims** (subcontractor's claim for work completed in the period). More types expected (variation orders, materials reimbursement, etc.) — keep the data model generic/extensible. Likely sits alongside Phase 4 (purchase requests): site raises → office processes → state machine → paid/closed. **Placement not decided — Stanley to confirm.**
