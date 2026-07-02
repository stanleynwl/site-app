-- SiteApp — partial deliveries. DO capture becomes the only way to confirm a
-- request delivered; a DO may cover less than the order, so requests gain a
-- 'partial' state and items track cumulative delivered quantity across DOs.
--
-- NOTE (SQL editor): ALTER TYPE ... ADD VALUE is safe here because nothing in
-- this file USES the new value. Do not add statements referencing 'partial'
-- to THIS file. Apply-before-deploy: code that writes status='partial' must
-- not ship before this runs.

alter type purchase_request_status add value if not exists 'partial' before 'delivered';

-- Cumulative received-so-far per line item, accumulated across multiple DOs.
-- Null = never counted (UI falls back to ordered quantity once delivered).
alter table public.purchase_request_items
  add column if not exists delivered_quantity numeric(12, 3);

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
