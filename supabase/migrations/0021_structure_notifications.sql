-- SiteApp Phase 10 — Progress/Stages "new input" notifications for the office.
-- The office project page now shows Progress and Stages as separate summaries
-- with a "New" badge when the site has submitted something the office hasn't
-- viewed yet. We need (a) an update timestamp on progress items (for "latest
-- updated" + new detection; stages already have completed_at) and (b) per-project
-- office last-seen markers that clear the badge once the office opens View all.
-- Additive + idempotent.

alter table public.block_progress_items
  add column if not exists updated_at timestamptz not null default now();

alter table public.projects
  add column if not exists progress_seen_at timestamptz,
  add column if not exists stages_seen_at timestamptz;

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
