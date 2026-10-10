-- Confirming a payment records when the money arrived and its bank reference (UTR / UPI transaction ID),
-- because both are known only when checking the bank. New arguments, so the function is dropped and recreated.

drop function public.payment_action(uuid, text, text);

create function public.payment_action(
  p_id uuid, p_action text, p_reason text default null, p_reference text default null, p_payment_date date default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  org uuid := public.current_org_id();
  pay public.payments;
  credit numeric;
begin
  select * into pay from public.payments where id = p_id and organization_id = org for update;
  if pay.id is null then
    raise exception 'Payment not found' using errcode = '22023';
  end if;
  -- Serialise everything that changes this client's credit.
  perform 1 from public.clients where id = pay.client_id for update;

  case p_action
  when 'confirm' then
    if not public.has_permission('payments.update') then raise exception 'permission denied' using errcode = '42501'; end if;
    if pay.status <> 'pending' then raise exception 'Only pending payments can be confirmed' using errcode = '22023'; end if;
    -- The date the money arrived and the bank reference are known only when confirming against the bank.
    if p_payment_date > public.ist_today() then
      raise exception 'The date received cannot be in the future' using errcode = '22023';
    end if;
    pay.payment_date := coalesce(p_payment_date, pay.payment_date);
    -- Lock the invoices, then re-check each allocation against the live balance (§9.4).
    perform 1 from public.invoices
    where id in (select invoice_id from public.payment_allocations where payment_id = p_id) order by id for update;
    if exists (select 1 from public.payment_allocations a join public.invoices i on i.id = a.invoice_id
               where a.payment_id = p_id and (i.status <> 'issued' or a.amount > public.balance_due(i))) then
      raise exception 'An invoice is no longer issued, or this payment is more than its balance' using errcode = '22023';
    end if;
    if pay.kind = 'refund' then
      select public.client_credit(c) into credit from public.clients c where c.id = pay.client_id;
      if pay.amount > credit then
        raise exception 'A refund cannot be more than the client credit (₹%)', credit using errcode = '22023';
      end if;
    end if;
    update public.payments
    set status = 'confirmed', confirmed_at = now(), confirmed_by = auth.uid(),
        payment_date = pay.payment_date,
        reference = coalesce(nullif(trim(p_reference), ''), reference),
        number = public.next_document_number('receipt', pay.payment_date)
    where id = p_id;

  when 'cancel' then
    if not public.has_permission('payments.cancel') then raise exception 'permission denied' using errcode = '42501'; end if;
    if pay.status = 'cancelled' then raise exception 'Already cancelled' using errcode = '22023'; end if;
    if nullif(trim(coalesce(p_reason, '')), '') is null then
      raise exception 'Give a reason for cancelling' using errcode = '22023';
    end if;
    update public.payments set status = 'cancelled', cancel_reason = trim(p_reason) where id = p_id;
    select public.client_credit(c) into credit from public.clients c where c.id = pay.client_id;
    if credit < 0 then
      raise exception 'This receipt''s credit was already refunded, so it cannot be cancelled' using errcode = '22023';
    end if;

  else
    raise exception 'Unknown action %', p_action using errcode = '22023';
  end case;
  return p_id;
end;
$$;

revoke execute on function public.payment_action from public, anon;
grant execute on function public.payment_action to authenticated;
