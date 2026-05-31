-- SiteApp Phase 9 — photos on the daily report.
-- Supervisors can attach photo(s) to a daily report (multiple, camera or
-- gallery). Stored in the shared photos table, linked to the report. Shown in
-- the office report view + the per-report PDF. Additive + idempotent.
--
-- daily_report_id is a discriminator like delivery_id / purchase_request_id /
-- block_id / is_project_ref: these must NOT appear in the progress gallery, so
-- getProjectPhotos also filters daily_report_id IS NULL.

alter table public.photos
  add column if not exists daily_report_id uuid
  references public.daily_reports(id) on delete cascade;

create index if not exists photos_daily_report_idx
  on public.photos (daily_report_id);

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
