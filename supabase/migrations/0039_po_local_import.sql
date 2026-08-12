-- SiteApp — carry the local office app's purchase-order fields, so its existing
-- POs can be imported into the shared table without losing anything.
--
-- The local app (D:\dev\siteapp-office, SQLite at data/office.db) models a PO
-- slightly differently to 0038:
--   * doc_type 'po' | 'memo' — a memo draws against a bulk PO (parent_po_id)
--   * doc_date is the DOCUMENT date and can be backdated (PO-4688 was created
--     2026-07-30 but dated 2026-04-30), so it is not created_at
--   * needed_by is FREE TEXT ("ASAP", "Upon Request", "11/08/2026") — it does
--     not fit 0038's date column, so it gets its own text column
--   * status 'amended' — imported as 'issued' with revision > 0, which already
--     conveys "issued then amended"
--
-- Additive + idempotent.

alter table public.purchase_orders add column if not exists doc_type         text not null default 'po';
alter table public.purchase_orders add column if not exists doc_date         date;
alter table public.purchase_orders add column if not exists needed_by_text   text;
alter table public.purchase_orders add column if not exists remark           text;
alter table public.purchase_orders add column if not exists site_contact     text;
alter table public.purchase_orders add column if not exists is_bulk          boolean not null default false;
-- Memos reference their bulk parent by NUMBER: the local row ids mean nothing
-- here, and the number is the key both systems share.
alter table public.purchase_orders add column if not exists parent_po_number text;
-- The local SQLite row id + PDF path, kept purely so a row can be traced back
-- to its origin when reconciling. Never used for joins.
alter table public.purchase_orders add column if not exists local_id         integer;
alter table public.purchase_orders add column if not exists pdf_path         text;

create index if not exists purchase_orders_doc_type_idx
  on public.purchase_orders (doc_type, created_at desc);

-- Keep the shared sequence ahead of every PO number that exists ---------------
-- Guards against the failure mode this migration was written after hitting: the
-- sequence in 0038 was seeded from the highest PO number then visible (4718),
-- but the local app had already reached 4725 — so the next web PO would have
-- collided. Importing calls this; the local app can call it any time too. Only
-- ever moves the sequence FORWARD, so it is safe to run repeatedly.
--
-- Only the 'PO%' series counts: MEMO-0001 is a separate numbering line and must
-- not drag the PO sequence down to 1.
create or replace function public.sync_po_sequence()
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_max  bigint;
  v_curr bigint;
begin
  select coalesce(max(nullif(regexp_replace(po_number, '\D', '', 'g'), '')::bigint), 0)
    into v_max
    from purchase_orders
   where po_number ilike 'PO%' and po_number ~ '[0-9]';

  select last_value into v_curr from po_number_seq;

  if v_max > coalesce(v_curr, 0) then
    perform setval('po_number_seq', v_max);
  end if;

  select last_value into v_curr from po_number_seq;
  return v_curr;
end $$;

revoke all on function public.sync_po_sequence() from public, anon;
grant execute on function public.sync_po_sequence() to authenticated, service_role;

-- Grants (explicit, to avoid the permission-denied trap — see 0004/0006) ------
grant all privileges on all tables    in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
