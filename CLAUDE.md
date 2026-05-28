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
- **Phase 4 (purchase requests):** 🔧 Code built & build-verified 2026-05-27. **Migration `0009` PENDING apply to hosted Supabase.**
- **Phase 5 (operations):** 🔧 Machinery (now a **daily-report section**, not standalone) + weekly stock counts built & build-verified 2026-05-27. **Migrations `0011` (stock) + `0012` (machinery-in-report; drops the old 0010 tables) PENDING.** Remaining: visitors/equipment on the daily report.
- **Phase 6–7:** not started.

## Phase 1 (done)
- **Soft-edit window:** Author can edit submitted report for 15 min. Edits logged to `report_edits`. PMs can unlock after hard-lock with a reason (sets status back to `draft`).
- **`no_work` report type:** `report_type` enum `normal | no_work`. When `no_work`, capture `no_work_reason` (`holiday | weather | site_closed | other`), hide manpower + work_done.
- **Pre-fill policy (explicit in code):** manpower YES · equipment YES (future) · weather NO · visitors NO · work_done NEVER · notes NEVER.
- **Default manpower trades:** fresh report pre-fills General worker, Carpenter, Bar bender, Bricklayer, Plasterer (0 each). "Subcontractor" column removed (too cramped on phone).
- **Backdated / missed-day reports:** `?date=` param + `report-date-nav.tsx` picker (today−14..today); `saveReport` validates via `normalizeReportDate`, sets `is_backdated`; amber banner in capture, "Backdated" badge in office.

## Phase 2 (in progress)
- **Suppliers = managed list** (not free-text). Catalog UI at `/office/catalog` (pm/office create). Data: `src/lib/data/catalog.ts`; actions `createSupplier`/`createMaterial`. Materials have `count_required`.
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

## Phase 4 (purchase requests — code built, migration pending)
Capture-only procurement. Supervisor raises a request at `/app/projects/[id]/requests` (`purchase-request-form.tsx`, material catalog/free-text + qty/unit/needed-by/urgency/note). Office works the queue at `/office/requests` (nav "Requests"): open requests across projects, oldest first, **aging colour** (24h amber / 48h red). State machine `pending → approved → po_issued → delivered → closed` (+ `rejected`); office actions `approvePurchaseRequest`/`rejectPurchaseRequest`/`issuePurchaseRequestPO` (captures PO#)/`closePurchaseRequest`. **Loop-closer:** linking a delivery to a request in the office delivery form (`setDeliveryOfficeFields` + `purchase_request_id` select) copies the request's qty into `deliveries.requested_quantity` and marks the request `delivered`. Data: `purchase-requests.ts`. Migration `0009_purchase_requests.sql` adds the table + enum + the forward-looking `deliveries.purchase_request_id` FK + RLS + grants.

## Phase 5 (operations — built, migrations pending)
**Machinery (in the daily report).** Per Stanley (2026-05-27), machinery is a **section of the daily report** like manpower — NOT a standalone page (the 0010 standalone feature was removed). One `machinery_entries` row = one machine + hours; repeat a type for multiple units (backhoe 8h + backhoe 4h when one broke down). Default types excavator/backhoe/backpusher (canonical English stored, localized via `Report.machineTypes.<key>`; `src/lib/machines.ts` mirrors `trades.ts`) + "Other" free-text. UI in `daily-report-form.tsx` (machinery section, mirrors manpower, controlled rows w/ a type `<select>` + hours); persisted by `saveReport` (delete+insert, drops 0-hour rows; normal reports only); shown in the office report view + the read-only locked view; pre-fills from yesterday like manpower. Migration `0012_machinery_in_report.sql` adds `machinery_entries` (RLS mirrors manpower_entries) and **drops the obsolete `machines`/`machine_logs` tables from 0010**.

**Weekly stock counts.** Supervisor records a physical count of a catalog material on a date at `/app/projects/[id]/stock` (`stock-count-form.tsx`, upsert on project+material+date). **Consumption is DERIVED, never stored** (Design Principle #3): per material, `consumption = previous_count + deliveries_in_(prev,latest] − latest_count`, where a delivery contributes `received_quantity ?? do_quantity` and only catalog-material (`material_id`) deliveries match. Computed in `getStockSummary` (stock.ts). Office project page + supervisor stock page show on-hand latest + derived "used since" per material. Action `recordStockCount`. Migration `0011_stock_counts.sql`. **Remaining Phase 5: visitors/equipment as secondary fields on the daily report.**

## Migrations
**Applied through 0010 + storage_setup on hosted Supabase (0009 + 0010 applied 2026-05-27). PENDING apply: `0011` (stock counts), `0012` (machinery-in-report — also drops the now-unused 0010 `machines`/`machine_logs`).**

## Photo archive (policy revised 2026-05-27)
`scripts/archive-photos.mjs` (`npm run archive`). Downloads photos to a local archive dir (mirrors `photos/{YYYY-MM}/...`), verifies, deletes the file from Storage, marks `photos.archived_at` (keeps the row). **Grace = 3 working days (Mon–Sat; Sundays don't count, Malaysia time)** before a photo is archived — recent photos stay visible for the office; tune via `GRACE_WORKING_DAYS`. **Also saves full metadata offline:** a sidecar `<file>.json` per photo (complete photo row + joined delivery record: supplier/material/project/qty/DO#/issue/note) + a run manifest, so the local archive is self-contained. The script **never deletes metadata** — rows are deleted only manually on Stanley's request. `withSignedUrls` skips archived photos. **Consequence: the app only shows photos captured since the previous run** — review/key-in recent deliveries before running. Needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (gitignored); optional `SITEAPP_ARCHIVE_DIR` (default `../siteapp-archive`). Scheduled biweekly via Windows Task Scheduler ("SiteApp Photo Archive"; Stanley moving it to Mon 10 PM w/ `-StartWhenAvailable`). See `scripts/README_archive.md`. Storage stays on Supabase for now; Cloudflare R2 (10 GB free, zero egress) is the documented fallback if the 1 GB free tier is outgrown.

## Deferred features (unscheduled — needs Stanley's placement decision)
### Claims submission (site → office)
Known claim types: **manpower monthly workdone card** (monthly summary of direct-labour work done) and **subcontractor claims** (subcontractor's claim for work completed in the period). More types expected (variation orders, materials reimbursement, etc.) — keep the data model generic/extensible. Likely sits alongside Phase 4 (purchase requests): site raises → office processes → state machine → paid/closed. **Placement not decided — Stanley to confirm.**
