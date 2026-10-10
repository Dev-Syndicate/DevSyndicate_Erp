-- Apply client credit (advances) to an issued invoice in one step, oldest receipts first (PRD §19:
-- "advance payments ... can be allocated when an invoice is issued").
-- Also: apply_payment is capped at the client's credit, because refunds reduce credit without reducing a
-- receipt's unallocated amount.

create or replace function public.apply_payment(p_payment_id uuid, p_invoice_id uuid, p_amount numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare
  org uuid := public.current_org_id();
  pay public.payments;
  inv public.invoices;
begin
  if not public.has_permission('payments.update') then raise exception 'permission denied' using errcode = '42501'; end if;
  select * into pay from public.payments where id = p_payment_id and organization_id = org for update;
  select * into inv from public.invoices where id = p_invoice_id and organization_id = org for update;
  if pay.id is null or inv.id is null or pay.kind <> 'receipt' or pay.status <> 'confirmed' then
    raise exception 'Choose a confirmed receipt and an invoice' using errcode = '22023';
  end if;
  if inv.client_id <> pay.client_id or inv.status <> 'issued' then
    raise exception 'The invoice must be issued to the same client' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'Enter an amount above 0' using errcode = '22023';
  end if;
  -- Refunds draw on client credit without touching a receipt's own allocations, so cap at the client's credit too.
  perform 1 from public.clients where id = pay.client_id for update;
  if p_amount > (select public.client_credit(c) from public.clients c where c.id = pay.client_id) then
    raise exception 'The client has only ₹% of credit left', (select public.client_credit(c) from public.clients c where c.id = pay.client_id)
      using errcode = '22023';
  end if;
  if p_amount > public.unallocated(pay) then
    raise exception 'Only ₹% of this receipt is unapplied', public.unallocated(pay) using errcode = '22023';
  end if;
  if p_amount > public.balance_due(inv) then
    raise exception 'The invoice balance is only ₹%', public.balance_due(inv) using errcode = '22023';
  end if;
  insert into public.payment_allocations (organization_id, payment_id, invoice_id, amount)
  values (org, p_payment_id, p_invoice_id, p_amount)
  on conflict (payment_id, invoice_id) do update set amount = public.payment_allocations.amount + excluded.amount;
end;
$$;

create function public.apply_client_credit(p_invoice_id uuid) returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invoices;
  pay public.payments;
  remaining numeric;
  take numeric;
  applied numeric := 0;
begin
  if not public.has_permission('payments.update') then raise exception 'permission denied' using errcode = '42501'; end if;
  select * into inv from public.invoices where id = p_invoice_id and organization_id = public.current_org_id() for update;
  if inv.id is null or inv.status <> 'issued' then
    raise exception 'Issue the invoice first' using errcode = '22023';
  end if;
  perform 1 from public.clients where id = inv.client_id for update;
  remaining := least(public.balance_due(inv), (select public.client_credit(c) from public.clients c where c.id = inv.client_id));

  for pay in
    select * from public.payments
    where client_id = inv.client_id and kind = 'receipt' and status = 'confirmed'
    order by payment_date, created_at
    for update
  loop
    exit when remaining <= 0;
    take := least(public.unallocated(pay), remaining);
    if take > 0 then
      insert into public.payment_allocations (organization_id, payment_id, invoice_id, amount)
      values (inv.organization_id, pay.id, inv.id, take)
      on conflict (payment_id, invoice_id) do update set amount = public.payment_allocations.amount + excluded.amount;
      remaining := remaining - take;
      applied := applied + take;
    end if;
  end loop;
  return applied;
end;
$$;

revoke execute on function public.apply_client_credit from public, anon;
grant execute on function public.apply_client_credit to authenticated;
