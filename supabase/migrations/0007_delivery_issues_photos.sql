-- SiteApp Phase 2 — delivery issues + photo linkage.
-- Photo-first delivery capture: supervisor flags an issue (chips) with an
-- optional note; photos attach to a delivery. Additive and idempotent.

-- Enum for delivery issues ----------------------------------------------------
do $$ begin
  create type delivery_issue as enum
    ('broken', 'missing', 'short', 'wrong_item', 'late', 'other');
exception when duplicate_object then null; end $$;

-- Deliveries: issue flag + free-text note -------------------------------------
alter table public.deliveries
  add column if not exists issue_type delivery_issue,
  add column if not exists note text;

-- Photos: link to a delivery (in addition to the existing report link) --------
alter table public.photos
  add column if not exists delivery_id uuid
    references public.deliveries(id) on delete set null;

create index if not exists photos_delivery_idx on public.photos (delivery_id);

-- Grants (consistency with 0004 / 0006) ---------------------------------------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
