-- SiteApp — backdated / missed-day reports.
-- Supervisors/PMs can fill a daily report for a PAST date that was missed
-- (e.g. a public holiday when nobody logged in). Reports entered for a date
-- other than their creation day are flagged is_backdated for office visibility.
-- Additive and idempotent.

alter table public.daily_reports
  add column if not exists is_backdated boolean not null default false;
