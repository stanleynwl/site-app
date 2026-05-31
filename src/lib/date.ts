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
// Also the "hold" window for an unsubmitted draft: if a day's report is never
// submitted, the supervisor can still open and finish it for this many days.
export const MAX_BACKDATE_DAYS = 10;

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

// True if a YYYY-MM-DD date string is a Sunday. Parsed as UTC midnight so the
// weekday is computed from the date itself, with no local-timezone drift.
export function isSunday(dateISO: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return false;
  return new Date(`${dateISO}T00:00:00Z`).getUTCDay() === 0;
}

// The MYT calendar date (YYYY-MM-DD) an ISO timestamp falls on.
function mytDateOf(iso: string, tz: string = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

// Amend window: the original author may keep editing a submitted report until
// the END OF THE DAY (Malaysia time) on which it was submitted. After midnight
// it hard-locks and needs a PM unlock. Safe on both server and client.
export function isInSoftEditWindow(submittedAt: string | null): boolean {
  if (!submittedAt) return false;
  return mytDateOf(submittedAt) === todayISO();
}
