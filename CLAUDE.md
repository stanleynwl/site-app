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
- **Phase 2:** 🔧 In progress — catalog, deliveries (three-quantity), photo-first capture, delete, photo archive all built & verified.
- **Phase 3+:** not started.

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

## Migrations
**All applied & verified through 0008 + storage_setup on hosted Supabase.**

## Photo archive (policy revised 2026-05-27)
`scripts/archive-photos.mjs` (`npm run archive`). **Downloads ALL live photos every run** (no age grace period) to a local archive dir (mirrors `photos/{YYYY-MM}/...`), verifies, deletes every file from Storage, marks `photos.archived_at` (keeps the row). Metadata rows are deleted only manually on Stanley's request. `withSignedUrls` skips archived photos. **Consequence: the app only shows photos captured since the previous run** — review/key-in recent deliveries before running. Needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (gitignored); optional `SITEAPP_ARCHIVE_DIR` (default `../siteapp-archive`). Scheduled biweekly via Windows Task Scheduler ("SiteApp Photo Archive"; Stanley moving it to Mon 10 PM w/ `-StartWhenAvailable`). See `scripts/README_archive.md`. Storage stays on Supabase for now; Cloudflare R2 (10 GB free, zero egress) is the documented fallback if the 1 GB free tier is outgrown.

## Deferred features (unscheduled — needs Stanley's placement decision)
### Claims submission (site → office)
Known claim types: **manpower monthly workdone card** (monthly summary of direct-labour work done) and **subcontractor claims** (subcontractor's claim for work completed in the period). More types expected (variation orders, materials reimbursement, etc.) — keep the data model generic/extensible. Likely sits alongside Phase 4 (purchase requests): site raises → office processes → state machine → paid/closed. **Placement not decided — Stanley to confirm.**
