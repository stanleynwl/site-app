-- SiteApp — cancelling a purchase order frees its number again.
--
-- 0038 handed numbers out of a Postgres sequence, which only ever moves forward:
-- cancel PO-4732 and the next order still became 4733, leaving 4732 burnt. The
-- office wants a cancelled number to come back round.
--
-- The number is now DERIVED from the table instead of held in a counter:
--
--     next = highest LIVE (non-cancelled) PO number + 1
--
-- so cancelling the most recent order immediately frees that number for the next
-- one. Cancelling an order in the MIDDLE of the run deliberately leaves a gap:
-- filling gaps would issue numbers out of order, and would also drag the book
-- back to the historical 4689-4714 gap that predates the app.
--
-- Trade-off accepted: a derived number is no longer "reserved" while a document
-- is being keyed, so two orders started at the same instant can compute the same
-- number. The unique index on po_number makes that a clean failure for the second
-- writer rather than a silent duplicate — which is what actually matters.
--
-- Additive + idempotent. po_number_seq is left in place but is no longer the
-- source of numbering.

create or replace function public.next_po_number()
returns text language sql security definer stable set search_path = public as $$
  select 'PO-' || (
    coalesce(
      max(nullif(regexp_replace(po_number, '\D', '', 'g'), '')::bigint),
      0
    ) + 1
  )::text
  from purchase_orders
  where po_number ilike 'PO%'
    and po_number ~ '[0-9]'
    and status <> 'cancelled';
$$;

-- Kept for the local office app, which calls it after every push. It no longer
-- drives numbering; it just reports the highest live number and keeps the old
-- sequence roughly in step so nothing referencing it is left stranded.
create or replace function public.sync_po_sequence()
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_max bigint;
begin
  select coalesce(max(nullif(regexp_replace(po_number, '\D', '', 'g'), '')::bigint), 0)
    into v_max
    from purchase_orders
   where po_number ilike 'PO%' and po_number ~ '[0-9]' and status <> 'cancelled';

  perform setval('po_number_seq', greatest(v_max, 1));
  return v_max;
end $$;

revoke all on function public.next_po_number()   from public, anon;
revoke all on function public.sync_po_sequence() from public, anon;
grant execute on function public.next_po_number()   to authenticated, service_role;
grant execute on function public.sync_po_sequence() to authenticated, service_role;

-- Grants (explicit, to avoid the permission-denied trap — see 0004/0006) ------
grant all privileges on all tables    in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
