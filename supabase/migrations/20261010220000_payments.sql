-- Payments (PRD §19–§20, v1.2): receipts and refunds, allocations to invoices, TDS, client credit, proof files.
-- Clients only read these tables; writes go through the functions below. Balances are computed, never stored.

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  number text,                                    -- assigned on confirm (§30, doc type 'receipt')
  kind text not null default 'receipt' check (kind in ('receipt', 'refund')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  client_id uuid not null references public.clients(id),
  payment_date date not null default public.ist_today(),
  amount numeric(14,2) not null check (amount >= 0),                    -- money that reached us (or went back, for refunds)
  tds_amount numeric(14,2) not null default 0 check (tds_amount >= 0),  -- income tax withheld by the client
  method text not null check (method in ('upi', 'bank_transfer', 'cash', 'credit_card', 'debit_card', 'cheque', 'other')),
  reference text not null default '',
  notes text not null default '',
  cancel_reason text,
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles(id),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount + tds_amount > 0),
  check (kind = 'receipt' or tds_amount = 0),
  check (status <> 'confirmed' or number is not null),
  check (status <> 'cancelled' or cancel_reason is not null)
);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  payment_id uuid not null references public.payments(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id),
  amount numeric(14,2) not null check (amount > 0),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (payment_id, invoice_id)
);

-- Polymorphic attachments (PRD §26). Only payments for now; expenses and others reuse it later.
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  entity_type text not null check (entity_type in ('payment')),
  entity_id uuid not null,
  path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes int not null check (size_bytes between 1 and 5242880),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create unique index payments_number on public.payments (organization_id, number) where number is not null;
create index on public.payments (organization_id, payment_date desc);
create index on public.payments (client_id);
create index on public.payments (confirmed_by);
create index on public.payment_allocations (payment_id);
create index on public.payment_allocations (invoice_id);
create index on public.payment_allocations (organization_id);
create index on public.documents (entity_type, entity_id);
create index on public.documents (organization_id);

create trigger set_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.payments for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.payment_allocations for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.documents for each row execute function public.audit_row_change();

alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.documents enable row level security;

create policy "payments.view reads payments" on public.payments for select to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('payments.view')));
create policy "payments.view reads allocations" on public.payment_allocations for select to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('payments.view')));
create policy "payments.create deletes pending" on public.payments for delete to authenticated
  using (organization_id = (select public.current_org_id()) and status = 'pending'
         and (select public.has_permission('payments.create')));

-- Documents follow the parent record's permissions (§26).
create policy "payment documents readable" on public.documents for select to authenticated
  using (organization_id = (select public.current_org_id()) and entity_type = 'payment'
         and (select public.has_permission('payments.view')));
create policy "payment documents added" on public.documents for insert to authenticated
  with check (organization_id = (select public.current_org_id()) and entity_type = 'payment'
              and ((select public.has_permission('payments.create')) or (select public.has_permission('payments.update')))
              and exists (select 1 from public.payments p where p.id = entity_id and p.organization_id = (select public.current_org_id())));
create policy "payment documents removed" on public.documents for delete to authenticated
  using (organization_id = (select public.current_org_id()) and entity_type = 'payment'
         and (select public.has_permission('payments.update')));

revoke all on public.payments, public.payment_allocations, public.documents from anon;

-- Private bucket for proofs; files under '<organization_id>/payment/<payment_id>/'.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

create policy "payment proofs readable" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select public.current_org_id())::text
         and (storage.foldername(name))[2] = 'payment' and (select public.has_permission('payments.view')));
create policy "payment proofs uploaded" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select public.current_org_id())::text
              and (storage.foldername(name))[2] = 'payment'
              and ((select public.has_permission('payments.create')) or (select public.has_permission('payments.update'))));
create policy "payment proofs removed" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select public.current_org_id())::text
         and (storage.foldername(name))[2] = 'payment' and (select public.has_permission('payments.update')));

-- ───────────────────────── Computed balances (PostgREST computed fields) ─────────────────────────

-- Σ confirmed allocations to an invoice (cash + TDS).
create function public.amount_paid(public.invoices) returns numeric
language sql stable set search_path = '' as $$
  select coalesce(sum(a.amount), 0) from public.payment_allocations a
  join public.payments p on p.id = a.payment_id
  where a.invoice_id = $1.id and p.status = 'confirmed';
$$;

-- Invoice balance (§9.2). Credit notes subtract here once they exist.
create function public.balance_due(public.invoices) returns numeric
language sql stable set search_path = '' as $$
  select $1.grand_total - public.amount_paid($1);
$$;

-- Settled value of a receipt not yet applied to invoices.
create function public.unallocated(public.payments) returns numeric
language sql stable set search_path = '' as $$
  select case when $1.kind = 'receipt'
              then $1.amount + $1.tds_amount
                   - coalesce((select sum(amount) from public.payment_allocations where payment_id = $1.id), 0)
              else 0 end;
$$;

-- Client credit (§9.2): confirmed receipts − their allocations − confirmed refunds.
create function public.client_credit(public.clients) returns numeric
language sql stable set search_path = '' as $$
  select coalesce(sum(case when p.kind = 'receipt' then public.unallocated(p) else -p.amount end), 0)
  from public.payments p where p.client_id = $1.id and p.status = 'confirmed';
$$;

-- ───────────────────────── Save a pending payment ─────────────────────────
-- p_data: { client_id, kind, payment_date, amount, tds_amount, method, reference, notes,
--           allocations: [{ invoice_id, amount }] }

create function public.save_payment(p_id uuid, p_data jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  org uuid := public.current_org_id();
  pid uuid := p_id;
  pay_kind text := coalesce(p_data->>'kind', 'receipt');
  cl public.clients;
  allocs jsonb := coalesce(p_data->'allocations', '[]');
  settled numeric := coalesce((p_data->>'amount')::numeric, 0) + coalesce((p_data->>'tds_amount')::numeric, 0);
begin
  if org is null or pay_kind not in ('receipt', 'refund')
     or not public.has_permission(case when pay_kind = 'refund' then 'payments.refund' else 'payments.create' end) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select * into cl from public.clients
  where id = (p_data->>'client_id')::uuid and organization_id = org and deleted_at is null;
  if cl.id is null then
    raise exception 'Select an active client' using errcode = '22023';
  end if;
  if settled <= 0 or coalesce((p_data->>'amount')::numeric, 0) < 0 or coalesce((p_data->>'tds_amount')::numeric, 0) < 0 then
    raise exception 'Enter the amount received' using errcode = '22023';
  end if;
  if pay_kind = 'refund' and (jsonb_array_length(allocs) > 0 or coalesce((p_data->>'tds_amount')::numeric, 0) <> 0) then
    raise exception 'A refund has no invoices or TDS' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(allocs) x
             left join public.invoices i on i.id = (x->>'invoice_id')::uuid and i.organization_id = org
             where i.id is null or i.client_id <> cl.id or i.status <> 'issued' or (x->>'amount')::numeric <= 0) then
    raise exception 'Choose issued invoices of this client, each with an amount above 0' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(allocs) x join public.invoices i on i.id = (x->>'invoice_id')::uuid
             where (x->>'amount')::numeric > public.balance_due(i)) then
    raise exception 'An amount is more than the invoice balance' using errcode = '22023';
  end if;
  if (select coalesce(sum((x->>'amount')::numeric), 0) from jsonb_array_elements(allocs) x) > settled then
    raise exception 'The invoices add up to more than the amount received plus TDS' using errcode = '22023';
  end if;

  if pid is null then
    insert into public.payments (organization_id, kind, client_id, amount, method)
    values (org, pay_kind, cl.id, settled, coalesce(p_data->>'method', 'bank_transfer'))
    returning id into pid;
  else
    -- Row lock: waits for a concurrent confirm, then re-checks the status.
    perform 1 from public.payments
    where id = pid and organization_id = org and status = 'pending' and kind = pay_kind for update;
    if not found then
      raise exception 'Only pending payments can be edited' using errcode = '22023';
    end if;
  end if;

  update public.payments
  set client_id = cl.id,
      payment_date = coalesce((p_data->>'payment_date')::date, public.ist_today()),
      amount = coalesce((p_data->>'amount')::numeric, 0),
      tds_amount = coalesce((p_data->>'tds_amount')::numeric, 0),
      method = p_data->>'method',
      reference = coalesce(p_data->>'reference', ''),
      notes = coalesce(p_data->>'notes', '')
  where id = pid;

  delete from public.payment_allocations where payment_id = pid;
  insert into public.payment_allocations (organization_id, payment_id, invoice_id, amount)
  select org, pid, (x->>'invoice_id')::uuid, (x->>'amount')::numeric from jsonb_array_elements(allocs) x;
  return pid;
end;
$$;

-- ───────────────────────── Confirm / cancel ─────────────────────────

create function public.payment_action(p_id uuid, p_action text, p_reason text default null) returns uuid
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

-- ───────────────────────── Apply / remove credit on confirmed receipts ─────────────────────────

create function public.apply_payment(p_payment_id uuid, p_invoice_id uuid, p_amount numeric) returns void
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

-- Removes an allocation of a confirmed receipt; the amount returns to client credit.
create function public.unapply_payment(p_allocation_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_permission('payments.update') then raise exception 'permission denied' using errcode = '42501'; end if;
  delete from public.payment_allocations a
  using public.payments p
  where a.id = p_allocation_id and p.id = a.payment_id
    and p.organization_id = public.current_org_id() and p.status = 'confirmed';
  if not found then
    raise exception 'Allocation not found' using errcode = '22023';
  end if;
end;
$$;

-- Invoices with confirmed payments cannot be cancelled (§16).
create or replace function public.invoice_action(p_id uuid, p_action text, p_reason text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  org uuid := public.current_org_id();
  inv public.invoices;
  cs public.company_settings;
  cl public.clients;
  quoted numeric;
  invoiced numeric;
  new_id uuid;
begin
  select * into inv from public.invoices where id = p_id and organization_id = org for update;
  if inv.id is null then
    raise exception 'Invoice not found' using errcode = '22023';
  end if;

  case p_action
  when 'issue' then
    if not public.has_permission('invoices.issue') then raise exception 'permission denied' using errcode = '42501'; end if;
    if inv.status <> 'draft' then raise exception 'Only drafts can be issued' using errcode = '22023'; end if;
    select * into strict cs from public.company_settings where organization_id = org;
    if inv.gst_applicable <> cs.gst_registered then
      raise exception 'Your GST registration changed since this draft was saved. Edit and save it again before issuing.' using errcode = '22023';
    end if;

    if inv.quotation_id is not null then
      select grand_total into quoted from public.quotations where id = inv.quotation_id for update;
      select coalesce(sum(grand_total), 0) + inv.grand_total into invoiced
      from public.invoices where quotation_id = inv.quotation_id and status = 'issued';
      if invoiced > quoted then
        if not public.has_permission('quotations.convert') then
          raise exception 'This invoice would take the total invoiced past the quotation total' using errcode = '22023';
        end if;
        if nullif(trim(coalesce(p_reason, '')), '') is null then
          raise exception 'This invoice takes the total invoiced past the quotation total. Give a reason to continue.'
            using errcode = '22023', hint = 'override_reason';
        end if;
      end if;
    end if;

    select * into strict cl from public.clients where id = inv.client_id;
    update public.invoices
    set status = 'issued',
        number = public.next_document_number('invoice', inv.invoice_date),
        issued_at = now(),
        issued_by = auth.uid(),
        billing_name = cl.company_name,
        billing_address = concat_ws(', ', nullif(cl.billing_address, ''), nullif(cl.city, ''), nullif(cl.state, ''),
                                    nullif(cl.pin_code, ''), nullif(cl.country, '')),
        billing_gstin = cl.gstin,
        lut_number = case when inv.supply_type = 'export' then cs.lut_number else '' end,
        over_quotation_reason = case when invoiced > quoted then trim(p_reason) end
    where id = p_id;

  when 'cancel' then
    if not public.has_permission('invoices.cancel') then raise exception 'permission denied' using errcode = '42501'; end if;
    if inv.status <> 'issued' then raise exception 'Only issued invoices can be cancelled' using errcode = '22023'; end if;
    if exists (select 1 from public.payment_allocations a join public.payments p on p.id = a.payment_id
               where a.invoice_id = p_id and p.status = 'confirmed') then
      raise exception 'This invoice has payments. Remove them from the invoice (they return to client credit) before cancelling.'
        using errcode = '22023';
    end if;
    update public.invoices set status = 'cancelled' where id = p_id;

  when 'duplicate' then
    if not public.has_permission('invoices.create') then raise exception 'permission denied' using errcode = '42501'; end if;
    insert into public.invoices
      (organization_id, client_id, contact_id, invoice_date, due_date, place_of_supply, supply_type, gst_applicable,
       discount_type, discount_value, terms, notes)
    select organization_id, client_id, contact_id, public.ist_today(), public.ist_today() + (due_date - invoice_date),
           place_of_supply, supply_type, gst_applicable, discount_type, discount_value, terms, notes
    from public.invoices where id = p_id
    returning id into new_id;
    insert into public.invoice_items
      (organization_id, invoice_id, position, description, sac_code, quantity, unit_price, discount_type, discount_value, tax_rate)
    select organization_id, new_id, position, description, sac_code, quantity, unit_price, discount_type, discount_value, tax_rate
    from public.invoice_items where invoice_id = p_id;
    perform public.recalculate_document('invoice', new_id);
    return new_id;

  else
    raise exception 'Unknown action %', p_action using errcode = '22023';
  end case;

  return p_id;
end;
$$;

revoke execute on function public.save_payment, public.payment_action, public.apply_payment, public.unapply_payment from public, anon;
grant execute on function public.save_payment, public.payment_action, public.apply_payment, public.unapply_payment to authenticated;
revoke execute on function public.amount_paid, public.balance_due, public.unallocated, public.client_credit from public, anon;
grant execute on function public.amount_paid, public.balance_due, public.unallocated, public.client_credit to authenticated;
