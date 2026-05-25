// Reports are keyed by calendar date in the site's local timezone, not the
// server's. Hardcoded to Malaysia for v1 (the user's sites). Revisit if SiteApp
// ever serves projects in other timezones.
export const APP_TIMEZONE = "Asia/Kuala_Lumpur";

// Returns today's date as YYYY-MM-DD in the app timezone. en-CA formats dates
// in ISO order, which is exactly the shape Postgres `date` columns expect.
export function todayISO(tz: string = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Returns YYYY-MM-DD for `n` days ago in the app timezone.
export function daysAgoISO(n: number, tz: string = APP_TIMEZONE): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// Returns YYYY-MM-DD for yesterday in the app timezone.
export function yesterdayISO(tz: string = APP_TIMEZONE): string {
  return daysAgoISO(1, tz);
}

// How far back a missed daily report may be backfilled (calendar days).
export const MAX_BACKDATE_DAYS = 14;

// Validates a YYYY-MM-DD report date for backfill: well-formed, not in the
// future, and within the allowed backdate window. Returns the date or null.
export function normalizeReportDate(
  raw: string,
  tz: string = APP_TIMEZONE,
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const today = todayISO(tz);
  const earliest = daysAgoISO(MAX_BACKDATE_DAYS, tz);
  // ISO date strings compare correctly as plain strings.
  if (raw > today || raw < earliest) return null;
  return raw;
}

const SOFT_EDIT_WINDOW_MS = 15 * 60 * 1000;

// True while the original author's 15-minute edit window is still open.
// Safe to call from both server and client code.
export function isInSoftEditWindow(submittedAt: string | null): boolean {
  if (!submittedAt) return false;
  return Date.now() - new Date(submittedAt).getTime() < SOFT_EDIT_WINDOW_MS;
}

// Whole minutes remaining in the soft-edit window (0 when expired).
export function softEditMinutesLeft(submittedAt: string | null): number {
  if (!submittedAt) return 0;
  const elapsed = Date.now() - new Date(submittedAt).getTime();
  return Math.max(0, Math.ceil((SOFT_EDIT_WINDOW_MS - elapsed) / 60_000));
}
