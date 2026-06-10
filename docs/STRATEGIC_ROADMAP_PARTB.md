# SiteApp — Part B: Strategic Roadmap

Date: 2026-06-10. Planning document only — no code changed. Scope respects the locked v2 decision (PowerSync + Capacitor offline rebuild): everything offline-related below is a cheap PWA-level win, not a sync engine.

---

## 1. Competitive scan (gaps only)

| Tool | One thing they have that SiteApp doesn't |
|---|---|
| **Procore** | Structured RFI / submittal workflows with full audit trail — formal correspondence between site, consultant, and client lives in the system, not WhatsApp. |
| **Fieldwire** | Plan/drawing viewer with pin-on-plan tasks and photos — a photo or punch item is dropped *on the floor plan*, giving instant spatial context. |
| **Autodesk Build** | Issue lifecycle with assignees, due dates, and statuses — SiteApp issues are flat text lines on a report; nobody owns them and nothing tracks closure. |
| **Buildertrend** | Client-facing portal with selections, schedule, and payment status — clients log in instead of receiving exported PDFs. |

Takeaway for "sellable": the nearest cheap echo of these is (a) giving daily-report **issues** an owner + open/closed status, and (b) eventually a read-only client login. Both are roadmap candidates, not now-work.

---

## 2. Field-worker UX assessment (gloves, sunlight, flaky 4G, 5-minute budget)

1. **Typed work is lost on a dead POST or a discarded tab.** `daily-report-form.tsx` keeps everything in uncontrolled inputs / local React state with no persistence. Android aggressively discards background PWA tabs; a supervisor who types 5 minutes of work-done, switches to the camera app, and comes back can lose the lot. A submit that fails mid-4G-dropout shows `saveError` but offers no retry and nothing is saved anywhere. This is the single biggest trust-killer.
2. **Tap targets are far below glove size.** The row-remove buttons in `daily-report-form.tsx` (manpower / machinery / issues / visitors) are `w-5 text-xs` — roughly 20px against the 44–48px minimum. "Add row" is a `text-xs underline` link. The photo-remove badge in `photo-capture.tsx` is `h-5 w-5`. Worker-count entry is a bare number input; gloved typing on a 96px-wide field is miserable where big +/− steppers would do.
3. **Sunlight contrast.** Secondary text throughout the site app is 50%-opacity foreground (`text-black/50 dark:text-white/50` — project subtitle in `app/projects/[id]/page.tsx`, hints, read-only report values) and inputs are `text-sm` on hairline `border-black/15` borders. At 50% opacity outdoors this approaches invisible. Needs a contrast pass on the `/app` tree specifically.
4. **Photo upload failures are quiet and unrecoverable.** `photo-capture.tsx` uploads sequentially, `continue`s past a failed file with one generic error line, never retries, and a photo that failed simply isn't attached — the supervisor may submit believing it is. Uploads also happen inline before submit, so a 10s-per-photo stall on bad 4G blocks the whole flow.
5. **Submit is buried; the offline page over-promises.** The submit/draft buttons sit at the very bottom of a long scrolling form (no sticky bar), so "am I done?" requires scrolling. Meanwhile `~offline/page.tsx` says "SiteApp will sync your reports automatically" — which is not true today — and is English-only despite the en/ms/zh rule.

---

## 3. Roadmap table

Impact 1–5 (field/business value). Effort 1–5 on solo-dev + Claude bandwidth (1 ≈ an evening, 3 ≈ a few days, 5 ≈ weeks).

| # | Item | Files touched | Impact | Effort | Net (I−E) | Notes |
|---|---|---|---|---|---|---|
| 1 | **Local draft persistence for site forms** — autosave to localStorage/IndexedDB as you type, restore on load, clear on confirmed save | `daily-report-form.tsx`, `purchase-request-form.tsx`, new `src/lib/use-form-draft.ts` | 5 | 2 | 3 | Biggest trust win; pure client-side, zero schema impact |
| 2 | **Photo upload queue with retry** — pending blobs persisted in IndexedDB, per-photo status chip, auto-retry on `online` event, manual retry button | `photo-capture.tsx`, new `src/lib/photo-queue.ts` | 5 | 3 | 2 | Fixes UX risk 4; submit blocks until queue is clean (or stores paths optimistically) |
| 3 | **Glove-grade tap targets + steppers + sticky submit** — 44px minimum controls, +/− steppers for counts/hours, sticky bottom save/submit bar | `daily-report-form.tsx`, `photo-capture.tsx`, `globals.css` | 4 | 2 | 2 | Fixes UX risks 2 and 5; mostly Tailwind class changes |
| 4 | **Submit retry-on-reconnect** — on a failed server-action POST keep state, show "no signal — will retry" banner, auto-resubmit on `online` | `daily-report-form.tsx`, small wrapper around `useActionState` | 4 | 2 | 2 | Pairs with #1; `saveReport` upsert is already idempotent per (project, date) |
| 5 | **Sunlight contrast pass on `/app`** — raise muted text 50%→70–75%, bump site-form font to base, stronger input borders | `globals.css`, `/app` pages, shared form classes | 3 | 1 | 2 | One sweep; verify outdoors on a real phone |
| 6 | **Office queue filters/search** — project + status + supplier filter chips and a text search on `/office/requests` and the DO queue | `office/requests/page.tsx`, `office/do-queue/page.tsx`, small client filter component | 3 | 2 | 1 | Office pain grows with every project added; URL-param filters keep pages server-rendered |
| 7 | **Office home dashboard** — per-project today-status row: report submitted? open requests (aged)? unfilled DO queue? unread structure changes | `office/page.tsx` (or new), reads from existing `reports.ts`/`purchase-requests.ts` | 4 | 3 | 1 | Stanley's morning glance; replaces clicking into each project |
| 8 | **Web Push via existing PM2 mirror** — VAPID push handler in `sw.ts`; `push_subscriptions` table; the local office mirror process (already polling Supabase) sends pushes via `web-push` | `sw.ts`, `notification-bell.tsx`, mirror script, **needs migration** | 4 | 3 | 1 | Cheapest credible push: no FCM account, no Edge Function; works tab-closed on Android; iOS needs Add-to-Home-Screen 16.4+ |
| 9 | **Skeletons + optimistic submits** — `loading.tsx` for `/app` routes, `useOptimistic` on progress/stage saves so taps feel instant on 4G | `app/**/loading.tsx`, `progress-item-row.tsx`, `stage-row.tsx` | 3 | 2 | 1 | Perceived speed is adoption fuel for non-tech users |
| 10 | **First-run hints + honest offline page** — one-time dismissible hint card per site screen (ms/zh first), fix `~offline/page.tsx` copy and i18n it | `~offline/page.tsx`, small `hint-card.tsx`, `messages/{en,ms,zh}.json` | 3 | 2 | 1 | Onboarding for supervisors Stanley can't train in person |
| 11 | **Issue lifecycle** — assignee + open/closed on report issues, office "open issues" list, closes the Autodesk-gap | `daily-report-form.tsx`, `reports.ts`, `actions.ts`, office views, **needs migration** | 4 | 4 | 0 | High value but real schema + flow work; sequence after the field-UX batch |
| 12 | **Tenant-prep audit (doc only)** — inventory single-tenant assumptions: global `project_members` everyone-sees-everything triggers, shared catalog/suppliers, `siteapp.app` synthetic emails, RLS without org scoping | new `docs/TENANT_AUDIT.md` | 2 | 1 | 1 | Do the audit cheap now so v2 schema decisions don't bake in blockers; actual multi-tenancy is far off — do not build yet |

Not proposed: any sync engine, background-sync API queue of server actions, or Capacitor work — all owned by the v2 PowerSync rebuild. Items 1, 2, 4 are deliberately throwaway-cheap bridges to it.

### Notification reliability verdict (asked explicitly)
Keep the 45s poll as the baseline — it works and costs nothing. The cheapest *real* upgrade is item 8: standard Web Push (VAPID) sent from the **already-running PM2 mirror process**, which already watches the activity table — no Supabase Edge Function, no paid tier, no FCM console (Chrome routes VAPID pushes through FCM transparently). Full FCM SDK integration is not worth it at this scale. Caveat to accept: iPhone push only works for the installed-PWA on iOS 16.4+, and the supervisors' primary need (office→site nudges) should be validated before building.

---

## 4. Top-3 build-next recommendation

### Pick 1 — Local draft persistence (#1)
- Approach: a `useFormDraft(key, form)` hook — serialize named form fields (plus the React-state rows for machinery/issues/visitors) to localStorage on a debounced `onChange`/`onInput` at the `<form>` level; key = `draft:report:{projectId}:{reportDate}`. On mount, if a draft exists and is newer than the server report's `updated_at`, restore and show a "restored unsaved draft" notice with a discard button. Clear the key when `useActionState` returns `ok`.
- Files: `daily-report-form.tsx`, `purchase-request-form.tsx`, new `src/lib/use-form-draft.ts`, three message files.
- Risks: stale-draft-over-newer-server-edit (compare timestamps, never silently overwrite); multi-device same-day edits; localStorage quota is fine at this payload size; don't persist photo blobs here (that's #2).
- Verify: type a report, kill the tab, reopen → everything restored; submit → draft gone; restore notice appears in all three locales.

### Pick 2 — Photo upload queue with retry (#2)
- Approach: new `src/lib/photo-queue.ts` storing `{id, blob, path, taken_at, gps, status, attempts}` in IndexedDB. `photo-capture.tsx` enqueues the compressed blob immediately (instant thumbnail, status chip: uploading / failed / done), a small runner uploads with capped exponential backoff and resumes on the `online` event and on next page load. Hidden `photo_path` inputs are emitted only for `done` photos; if anything is still pending at submit, block with "X photos still uploading — retry/wait/remove".
- Files: `photo-capture.tsx`, new `photo-queue.ts`, message files.
- Risks: IndexedDB blob storage on older Android WebView (feature-detect, fall back to current behavior); duplicate uploads after a retry race (the UUID path makes re-upload of the same path idempotent-enough — use `upsert: true`); orphaned storage objects on abandon (existing orphan-cleanup script already handles this class).
- Verify: airplane-mode mid-upload → chip shows failed; restore network → auto-completes; submitted delivery/report shows all photos office-side.

### Pick 3 — Glove-grade tap targets + steppers + sticky submit (#3)
- Approach: a shared `min-h-11 min-w-11` (44px) rule for every interactive control in the site forms; replace the `w-5` ✕ buttons with full-height bordered buttons; replace bare number inputs for worker counts and machine hours with a stepper (−/value/+, long-press repeat optional, keyboard input still allowed); make the draft/submit row `sticky bottom-0` with a safe-area-padded surface background so it never scrolls out of reach.
- Files: `daily-report-form.tsx`, `photo-capture.tsx`, possibly a small `stepper.tsx`, `globals.css`.
- Risks: sticky bar overlapping the last field on small viewports (add bottom padding to the form); steppers must not break the existing `manpower_worker_count`/`machinery_hours` FormData names that `saveReport` parses; dark-mode/print unaffected.
- Verify: Chrome DevTools mobile emulation + a real phone with gloves; confirm `saveReport` still receives identical FormData; run the existing report submit flow end-to-end.

**Sequencing note:** picks 1–3 plus items 4 and 5 form one coherent "field reliability batch" — all client-side, no migrations, individually shippable, and none of it is thrown away by the v2 PowerSync rebuild (drafts and the photo queue become redundant then, but they're days of work, not weeks, and they carry the pilot until v2).
