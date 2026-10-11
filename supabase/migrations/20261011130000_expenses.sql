-- Expenses (PRD §21, v1.4): money DevSyndicate pays, recorded when paid (cash basis; no bills / payables in V1).
-- GST paid with input tax credit and reverse charge (GST-registered only), TDS withheld from the vendor,
-- receipts in public.documents. Clients only read the table; writes go through save_expense.

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  number text not null,                                   -- EXP/26-27/0001, assigned on create (§30)
  expense_date date not null default public.ist_today(),
  category_id uuid not null references public.expense_categories(id),
  vendor_id uuid references public.vendors(id),
  description text not null check (length(trim(description)) between 1 and 500),
  vendor_invoice_number text not null default '',         -- the vendor's bill number (needed to claim ITC)
  amount numeric(14,2) not null check (amount > 0),       -- bill total incl. GST, before TDS: the cost (§9.2)
  gst_amount numeric(14,2) not null default 0 check (gst_amount >= 0),
  itc_eligible boolean not null default false,            -- GST claimable as input tax credit (CGST §16, not blocked by §17(5))
  reverse_charge boolean not null default false,          -- we pay the GST ourselves (RCM): gst_amount is on top of amount
  tds_amount numeric(14,2) not null default 0 check (tds_amount >= 0),  -- income tax we withheld; the vendor got amount − TDS
  method text not null check (method in ('upi', 'bank_transfer', 'cash', 'credit_card', 'debit_card', 'cheque', 'other')),
  reference text not null default '',
  notes text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reverse_charge or gst_amount < amount),
  check (tds_amount < amount),
  check (gst_amount > 0 or (not itc_eligible and not reverse_charge))
);

create unique index expenses_number on public.expenses (organization_id, number);
create index on public.expenses (organization_id, expense_date desc);
create index on public.expenses (category_id);
create index on public.expenses (vendor_id);

create trigger set_updated_at before update on public.expenses for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.expenses for each row execute function public.audit_row_change();

alter table public.expenses enable row level security;

create policy "expenses.view reads expenses" on public.expenses for select to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('expenses.view')));
create policy "expenses.delete deletes expenses" on public.expenses for delete to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('expenses.delete')));

revoke all on public.expenses from anon;

-- ───────────────────────── Receipts: documents for expenses too ─────────────────────────
-- One policy per action covering both parents (avoids multiple permissive policies).

alter table public.documents drop constraint documents_entity_type_check;
alter table public.documents add constraint documents_entity_type_check check (entity_type in ('payment', 'expense'));

drop policy "payment documents readable" on public.documents;
drop policy "payment documents added" on public.documents;
drop policy "payment documents removed" on public.documents;

create policy "documents readable" on public.documents for select to authenticated
  using (organization_id = (select public.current_org_id())
         and case entity_type when 'payment' then (select public.has_permission('payments.view'))
                              when 'expense' then (select public.has_permission('expenses.view')) end);
create policy "documents added" on public.documents for insert to authenticated
  with check (organization_id = (select public.current_org_id())
              and case entity_type
                    when 'payment' then ((select public.has_permission('payments.create')) or (select public.has_permission('payments.update')))
                      and exists (select 1 from public.payments p where p.id = entity_id and p.organization_id = (select public.current_org_id()))
                    when 'expense' then ((select public.has_permission('expenses.create')) or (select public.has_permission('expenses.update')))
                      and exists (select 1 from public.expenses e where e.id = entity_id and e.organization_id = (select public.current_org_id()))
                  end);
-- Deleting an expense removes its receipts, so expenses.delete may remove them too.
create policy "documents removed" on public.documents for delete to authenticated
  using (organization_id = (select public.current_org_id())
         and case entity_type when 'payment' then (select public.has_permission('payments.update'))
                              when 'expense' then (select public.has_permission('expenses.update')) or (select public.has_permission('expenses.delete')) end);

-- Files under '<organization_id>/expense/<expense_id>/'.
create policy "expense receipts readable" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select public.current_org_id())::text
         and (storage.foldername(name))[2] = 'expense' and (select public.has_permission('expenses.view')));
create policy "expense receipts uploaded" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select public.current_org_id())::text
              and (storage.foldername(name))[2] = 'expense'
              and ((select public.has_permission('expenses.create')) or (select public.has_permission('expenses.update'))));
create policy "expense receipts removed" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select public.current_org_id())::text
         and (storage.foldername(name))[2] = 'expense'
         and ((select public.has_permission('expenses.update')) or (select public.has_permission('expenses.delete'))));

-- ───────────────────────── Save ─────────────────────────
-- p_data: { expense_date, category_id, vendor_id, description, vendor_invoice_number, amount, gst_amount,
--           itc_eligible, reverse_charge, tds_amount, method, reference, notes }

create function public.save_expense(p_id uuid, p_data jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  org uuid := public.current_org_id();
  eid uuid := p_id;
  prev public.expenses;
  edate date := coalesce((p_data->>'expense_date')::date, public.ist_today());
  cat uuid := (p_data->>'category_id')::uuid;
  ven uuid := nullif(p_data->>'vendor_id', '')::uuid;
  amt numeric := coalesce((p_data->>'amount')::numeric, 0);
  tds numeric := coalesce((p_data->>'tds_amount')::numeric, 0);
  gst_reg boolean;
  gst numeric;
  rcm boolean;
begin
  if org is null or not public.has_permission(case when p_id is null then 'expenses.create' else 'expenses.update' end) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_id is not null then
    select * into prev from public.expenses where id = p_id and organization_id = org for update;
    if prev.id is null then
      raise exception 'Expense not found' using errcode = '22023';
    end if;
  end if;

  -- Recorded when paid (§21), so never in the future.
  if edate > public.ist_today() then
    raise exception 'The date can''t be in the future' using errcode = '22023';
  end if;
  -- Archived categories and vendors stay valid on expenses that already use them (§22).
  if not exists (select 1 from public.expense_categories
                 where id = cat and organization_id = org and (is_active or id = prev.category_id)) then
    raise exception 'Select a category' using errcode = '22023';
  end if;
  if ven is not null and not exists (select 1 from public.vendors
                                     where id = ven and organization_id = org and (deleted_at is null or id = prev.vendor_id)) then
    raise exception 'Select an active vendor' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_data->>'description', ''))) = 0 then
    raise exception 'Enter a description' using errcode = '22023';
  end if;

  -- GST fields need a GSTIN: input tax credit and reverse charge exist only for GST-registered companies.
  select gst_registered into gst_reg from public.company_settings where organization_id = org;
  gst := case when gst_reg then coalesce((p_data->>'gst_amount')::numeric, 0) else 0 end;
  rcm := gst_reg and gst > 0 and coalesce((p_data->>'reverse_charge')::boolean, false);
  if amt <= 0 then
    raise exception 'Enter the amount paid' using errcode = '22023';
  end if;
  if gst < 0 or (not rcm and gst >= amt) then
    raise exception 'GST must be less than the total amount' using errcode = '22023';
  end if;
  if tds < 0 or tds >= amt then
    raise exception 'TDS must be less than the amount' using errcode = '22023';
  end if;

  if eid is null then
    insert into public.expenses (organization_id, number, expense_date, category_id, description, amount, method)
    values (org, public.next_document_number('expense', edate), edate, cat, p_data->>'description', amt,
            coalesce(p_data->>'method', 'bank_transfer'))
    returning id into eid;
  end if;

  update public.expenses
  set expense_date = edate,
      category_id = cat,
      vendor_id = ven,
      description = trim(p_data->>'description'),
      vendor_invoice_number = trim(coalesce(p_data->>'vendor_invoice_number', '')),
      amount = amt,
      gst_amount = gst,
      itc_eligible = gst > 0 and coalesce((p_data->>'itc_eligible')::boolean, false),
      reverse_charge = rcm,
      tds_amount = tds,
      method = p_data->>'method',
      reference = trim(coalesce(p_data->>'reference', '')),
      notes = trim(coalesce(p_data->>'notes', ''))
  where id = eid;
  return eid;
end;
$$;

revoke execute on function public.save_expense from public, anon;
grant execute on function public.save_expense to authenticated;
