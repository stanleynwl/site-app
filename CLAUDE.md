@AGENTS.md

# SiteApp — Claude session context

Full design doc: `docs/STATUS_ADDENDUM.md`. Read it before any non-trivial work.

## Stack (locked)
Next.js 16 (Turbopack) · TypeScript · Tailwind v4 · Supabase · Vercel · PWA (@serwist/turbopack)

## Critical Next.js 16 notes
- Middleware renamed to **Proxy** (`src/proxy.ts`)
- `cookies()` is async
- Docs at `node_modules/next/dist/docs/` — training data is stale, read these first

## Auth
Username + password. Synthetic emails: `username@siteapp.local`. No public sign-up. Create users manually in Supabase dashboard. See `supabase/README.md`.

## i18n
next-intl v4 without routing. Locale via `locale` cookie. Messages: `src/messages/{en,ms,zh}.json`. All user-visible strings must be i18n'd in all three locales.

## Phase status
- **Phase 0:** ✅ Done
- **Phase 1:** ⚠️ Code-complete, pending Supabase e2e test. Migration `0003` written, pending application.
- **Phase 2+:** Blocked until Phase 1 e2e test passes.

## Locked decisions (Phase 1 additions — implemented, not yet tested)
- **Soft-edit window:** Author can edit submitted report for 15 min. Edits logged to `report_edits`. PMs can unlock after hard-lock with a reason (sets status back to `draft`).
- **`no_work` report type:** `report_type` enum `normal | no_work`. When `no_work`, capture `no_work_reason` (`holiday | weather | site_closed | other`), hide manpower + work_done fields.
- **Pre-fill policy (explicit in code):** manpower YES · equipment YES (future) · weather NO · visitors NO · work_done NEVER · notes NEVER.

## Key file map
- `src/lib/data/reports.ts` — types + read queries
- `src/lib/data/actions.ts` — Server Actions (saveReport, unlockReport, createProject)
- `src/components/daily-report-form.tsx` — supervisor capture form
- `src/lib/date.ts` — timezone helpers + soft-edit window util
- `supabase/migrations/` — 0001 init, 0002 Phase 1, 0003 soft-edit + no_work

## Deferred features (unscheduled — needs Stanley's placement decision)

### Claims submission (site → office)
Known claim types: **manpower monthly workdone card** (monthly summary of direct-labour work done, submitted as a claim) and **subcontractor claims** (subcontractor's claim for work completed in the period). More types expected (variation orders, materials reimbursement, etc.) — keep the data model generic/extensible.
Likely sits alongside Phase 4 (purchase requests) given the same pattern: site raises → office processes → state machine → paid/closed. **Placement not decided — Stanley to confirm.**

## Do NOT start Phase 2 until Phase 1 e2e test passes (Stanley's rule)
