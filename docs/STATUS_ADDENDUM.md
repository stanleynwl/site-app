# SiteApp — Status & Design Addendum

## Current status

**Phase 0 (Foundations):** ✅ Done. Next.js 16 + TypeScript + Tailwind v4 + Supabase + i18n (EN/MS/中文) + PWA shell via @serwist/turbopack. Build passes, dev server runs on port 3460.

**Phase 1 (Daily reports):** ⚠️ Code-complete, not yet verified. Database migrated to real Supabase (7 tables, RLS, lock-after-submit). Supervisor capture flow and office views built. Auth uses username + password mapped to synthetic @siteapp.local emails. Pending action when back at PC: run final SQL to set password (`update auth.users set encrypted_password = crypt('Test1234!', gen_salt('bf')) where id = '00f76cda-f4ad-4471-a07d-80fd76241f39'`), then log in as `pridemission0303 / Test1234!` and run the 9-step end-to-end test.

Not in any phase right now. Phase 2 does not start until the Phase 1 test passes.

## Tech stack (locked)

Next.js 16 (Turbopack) + TypeScript + Tailwind v4, Supabase (Postgres + Auth + Storage), Vercel hosting, GitHub. PowerSync for offline sync (Phase 3) — free tier sufficient at expected scale, photos go direct to Supabase Storage via attachment pattern. Capacitor as iOS escape hatch if PWA storage gets evicted. Cost: ~$0 until photo volume exceeds 1 GB, then Supabase Pro at $25/mo.

## Revised phase plan

**Phase 1** — Daily reports. Code done, awaiting test. Adds: 15-minute soft-edit window after submission, "no work today" entry type, explicit per-field pre-fill policy.

**Phase 2** — Photos, deliveries, three-quantity model. Photo capture with EXIF/GPS + client-side compression + signed-URL storage. Per-project taxonomy (block/level/area/activity), editable mid-project. Delivery logging from supervisor side with three quantities: `requested_quantity` (nullable, FK to future purchase request), `do_quantity` (office data entry from DO photo), `received_quantity` (optional, supervisor at delivery, only shown for materials flagged "count required"). Variance surfaced in office dashboard.

**Phase 3** — Offline sync. PowerSync + local SQLite on phone, attachment queue for photos. Conflict policy: drafts merge, submitted overrides drafts, audit log of every conflict. Capacitor-wrappable.

**Phase 4** — Purchase requests (capture-only). Supervisor raises request. Office queue with aging (color-coded by hours waited). State machine: pending → approved → PO issued (PO number captured, PO itself issued outside the app) → delivered (linked to a DO) → closed. Request-to-DO matching closes the variance loop.

**Phase 5** — Operations layer. Machinery daily log (company-scoped with project assignment): present/hours/breakdown/operator/fuel per machine per day. Weekly stock-on-site counts (consumption derived as previous + deliveries − current — explicitly not per-day consumption tracking). Visitors/equipment as secondary fields on daily report, hidden behind "+ Add" links.

**Phase 6** — PDF export, three audiences. Consultant (EOT evidence: weather hours, manpower, delays). Client (photos + progress narrative). Boss (exceptions only: stuck items, overdue requests, variances). Same data, three layouts. One-click from office dashboard.

**Phase 7** — Pilot and harden. Real foreman on real sites for 4+ weeks. No new features, only fixes/polish/performance. Verify "5-minute daily report" promise empirically.

Out of scope for v1: predictive reorder, WhatsApp bridge, native mobile, multi-tenancy, billing, per-day consumption tracking.

## Design principles

1. **Daily report stays under 5 minutes.** Anything else goes on its own screen on its own schedule. Every new feature must answer: does this add a field to the daily report? If yes, what comes off?
2. **Capture friction is the enemy of data quality.** Default to optional, one-tap confirmations, pre-fill from known values.
3. **Track what's verifiable, derive what isn't.** Stock-on-site is verifiable; daily consumption is not. Build for the first, derive the second.
4. **Schema permissiveness for future features.** Add nullable FKs for future tables now. Specifically: DOs get nullable `purchase_request_id` from Phase 2 even though purchase requests aren't built until Phase 4.
5. **Three-way variance is the loop-closer.** Material flow captured at three points (request, DO, physical receipt) by three different parties; variance surfaces problems automatically.

## Decisions locked in

- **Soft-edit window:** original author can edit submitted reports for 15 minutes, then hard-lock. All edits during the window are logged. PMs can unlock with reason after the hard-lock.
- **No-work-today report type:** valid report types are `normal` and `no_work` with reason (`holiday / weather / site_closed / other`).
- **Yesterday's draft pre-fill policy:** manpower and equipment pre-fill; weather and visitors do NOT pre-fill; work done and notes never pre-fill.
- **Photo taxonomy:** per-project, editable mid-project, supervisors can suggest tags (office approves).
- **Voice input:** built-in phone dictation for v1; store raw audio alongside transcript so future re-transcription with Whisper is possible without data loss.
- **Three-quantity delivery model:** `requested_quantity`, `do_quantity`, `received_quantity` per delivery row. Materials have `count_required` boolean flag controlling whether supervisor sees the received field.
- **Procurement is capture-only in v1:** app tracks request → approval → PO number; PO itself is issued outside the app.
- **Office queue has aging:** pending requests sorted oldest first, color-coded by hours waited (24h yellow, 48h red).
- **Per-day consumption tracking is rejected.** Use weekly stock counts and derive consumption.
- **Machinery is company-scoped with project assignment** (machines move between projects).
- **PDF export is three templates, not one:** consultant / client / boss.

## Deferred features (unscheduled — needs Stanley's placement decision)

### Claims submission (site → office)
Known claim types: **manpower monthly workdone card** (monthly summary of direct-labour work done, submitted as a claim) and **subcontractor claims** (subcontractor's claim for work completed in the period). More types are expected (variation orders, materials reimbursement, etc.) — the data model should be generic enough to extend without schema changes per claim type.

Likely sits alongside Phase 4 (purchase requests) since both follow the same pattern: site raises → office processes → state machine → paid/closed. **Placement not decided — Stanley to confirm before design begins.**

## Open questions (need decision before relevant phase)

- **Suppliers:** managed list or free-text? Leaning managed (10–20 regular suppliers, unlocks "show me everything from Supplier X" analytics). Needs decision before Phase 2 schema.
- **Approval chain:** single-approver or multi-step? Single for v1; data model should accommodate a chain later.
- **Urgency on purchase requests:** how to prevent abuse? Leaning toward required free-text "why urgent" rather than discrete urgency categories.
- **Fuel logging granularity:** per-refuel vs per-day total. Leaning per-day total with optional refuel notes.

## Glossary

- **Delivery** — materials arriving on site, with DO photo and optional three-quantity row.
- **Purchase request** — supervisor's ask for material to be ordered (distinct from PO).
- **PO** — office-issued order to a supplier; tracked by PO number; document lives outside the app in v1.
- **Stock count** — periodic (weekly) physical count of material on site, used to derive consumption.
- **Variance** — computed difference between requested, DO, and received quantities (or expected vs actual).
- **Aging** — time elapsed since a pending request was raised.

## Immediate next steps (Stanley's TODO when back at PC)

1. Run the password reset SQL in Supabase (above).
2. Log in to the dev server at http://localhost:3460 as `pridemission0303 / Test1234!`.
3. Run the 9-step end-to-end test from the Phase 1 spec.
4. Apply migration `0003_soft_edit_no_work.sql` to the hosted Supabase project.
5. Only after that passes: begin Phase 2 (photos + three-quantity deliveries). Decide the supplier question first.
