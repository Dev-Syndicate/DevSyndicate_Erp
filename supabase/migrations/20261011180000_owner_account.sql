-- Owner's account and company balance (PRD §21.1, v1.5). DevSyndicate is a sole proprietorship: money the owner takes
-- out is drawings and money he puts in is capital introduced. Both change the owner's capital and the company balance,
-- never revenue, expenses or Net Profit. Company balance = opening balance + receipts − refunds − expenses − drawings
-- + capital introduced, from the opening balance date.

-- ───────────────────────── Permissions ─────────────────────────
insert into public.permissions (key) values ('owner.view'), ('owner.create'), ('owner.update'), ('owner.delete');

insert into public.role_permissions (role_id, permission)
select r.id, p.key from public.roles r cross join (values ('owner.view'), ('owner.create'), ('owner.update'), ('owner.delete')) as p(key)
where r.key in ('super_admin', 'admin');

-- ───────────────────────── Opening balance ─────────────────────────
alter table public.company_settings
  add column opening_balance numeric(14,2) not null default 0 check (opening_balance >= 0),
  add column opening_balance_date date not null default '2026-04-01';

-- ───────────────────────── Owner transactions ─────────────────────────
create table public.owner_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  kind text not null check (kind in ('drawing', 'capital')),     -- drawing = owner took money out; capital = owner put money in
  txn_date date not null default public.ist_today(),
  amount numeric(14,2) not null check (amount > 0),
  method text not null check (method in ('upi', 'bank_transfer', 'cash', 'credit_card', 'debit_card', 'cheque', 'other')),
  reference text not null default '',
  notes text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.owner_transactions (organization_id, txn_date desc);

create trigger set_updated_at before update on public.owner_transactions for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.owner_transactions for each row execute function public.audit_row_change();

alter table public.owner_transactions enable row level security;

create policy "owner.view reads owner transactions" on public.owner_transactions for select to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('owner.view')));
create policy "owner.delete deletes owner transactions" on public.owner_transactions for delete to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('owner.delete')));

revoke all on public.owner_transactions from anon;

-- p_data: { kind, txn_date, amount, method, reference, notes }
create function public.save_owner_transaction(p_id uuid, p_data jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  org uuid := public.current_org_id();
  tid uuid := p_id;
  tdate date := coalesce((p_data->>'txn_date')::date, public.ist_today());
  amt numeric := coalesce((p_data->>'amount')::numeric, 0);
begin
  if org is null or not public.has_permission(case when p_id is null then 'owner.create' else 'owner.update' end) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_id is not null and not exists (select 1 from public.owner_transactions where id = p_id and organization_id = org) then
    raise exception 'Transaction not found' using errcode = '22023';
  end if;
  if tdate > public.ist_today() then
    raise exception 'The date can''t be in the future' using errcode = '22023';
  end if;
  if amt <= 0 then
    raise exception 'Enter the amount' using errcode = '22023';
  end if;
  if coalesce(p_data->>'kind', '') not in ('drawing', 'capital') then
    raise exception 'Choose drawing or capital introduced' using errcode = '22023';
  end if;

  if tid is null then
    insert into public.owner_transactions (organization_id, kind, txn_date, amount, method)
    values (org, p_data->>'kind', tdate, amt, coalesce(p_data->>'method', 'bank_transfer'))
    returning id into tid;
  end if;
  update public.owner_transactions
  set kind = p_data->>'kind',
      txn_date = tdate,
      amount = amt,
      method = p_data->>'method',
      reference = trim(coalesce(p_data->>'reference', '')),
      notes = trim(coalesce(p_data->>'notes', ''))
  where id = tid;
  return tid;
end;
$$;

revoke execute on function public.save_owner_transaction from public, anon;
grant execute on function public.save_owner_transaction to authenticated;

-- ───────────────────────── Proofs: documents for owner transactions ─────────────────────────
alter table public.documents drop constraint documents_entity_type_check;
alter table public.documents add constraint documents_entity_type_check check (entity_type in ('payment', 'expense', 'owner'));

drop policy "documents readable" on public.documents;
drop policy "documents added" on public.documents;
drop policy "documents removed" on public.documents;

create policy "documents readable" on public.documents for select to authenticated
  using (organization_id = (select public.current_org_id())
         and case entity_type when 'payment' then (select public.has_permission('payments.view'))
                              when 'expense' then (select public.has_permission('expenses.view'))
                              when 'owner' then (select public.has_permission('owner.view')) end);
create policy "documents added" on public.documents for insert to authenticated
  with check (organization_id = (select public.current_org_id())
              and case entity_type
                    when 'payment' then ((select public.has_permission('payments.create')) or (select public.has_permission('payments.update')))
                      and exists (select 1 from public.payments p where p.id = entity_id and p.organization_id = (select public.current_org_id()))
                    when 'expense' then ((select public.has_permission('expenses.create')) or (select public.has_permission('expenses.update')))
                      and exists (select 1 from public.expenses e where e.id = entity_id and e.organization_id = (select public.current_org_id()))
                    when 'owner' then ((select public.has_permission('owner.create')) or (select public.has_permission('owner.update')))
                      and exists (select 1 from public.owner_transactions o where o.id = entity_id and o.organization_id = (select public.current_org_id()))
                  end);
create policy "documents removed" on public.documents for delete to authenticated
  using (organization_id = (select public.current_org_id())
         and case entity_type when 'payment' then (select public.has_permission('payments.update'))
                              when 'expense' then (select public.has_permission('expenses.update')) or (select public.has_permission('expenses.delete'))
                              when 'owner' then (select public.has_permission('owner.update')) or (select public.has_permission('owner.delete')) end);

-- Files under '<organization_id>/owner/<transaction_id>/'.
create policy "owner proofs readable" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select public.current_org_id())::text
         and (storage.foldername(name))[2] = 'owner' and (select public.has_permission('owner.view')));
create policy "owner proofs uploaded" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select public.current_org_id())::text
              and (storage.foldername(name))[2] = 'owner'
              and ((select public.has_permission('owner.create')) or (select public.has_permission('owner.update'))));
create policy "owner proofs removed" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select public.current_org_id())::text
         and (storage.foldername(name))[2] = 'owner'
         and ((select public.has_permission('owner.update')) or (select public.has_permission('owner.delete'))));

-- ───────────────────────── Dashboard: company balance, drawings ─────────────────────────
create or replace function public.dashboard(p_from date, p_to date) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with
  pay as (
    select payment_date, kind, amount, tds_amount from public.payments where status = 'confirmed'
  ),
  open_inv as (
    select i.invoice_date, i.due_date, public.balance_due(i) as balance
    from public.invoices i where i.status = 'issued'
  ),
  open_bal as (select * from open_inv where balance > 0),
  -- Chart: the 12 months of the financial year (April–March) that p_from falls in.
  fy as (
    select make_date(extract(year from p_from)::int - case when extract(month from p_from) < 4 then 1 else 0 end, 4, 1) as start
  ),
  months as (select generate_series(fy.start, fy.start + interval '11 months', interval '1 month')::date as m from fy),
  cs as (select opening_balance, opening_balance_date from public.company_settings)
  select jsonb_build_object(
    -- Revenue: settled value of receipts (cash + TDS) − refunds, by payment date (§9.2)
    'revenue', (select coalesce(sum(case when kind = 'receipt' then amount + tds_amount else -amount end), 0)::text
                from pay where payment_date between p_from and p_to),
    'tds_receivable', (select coalesce(sum(tds_amount), 0)::text from pay where kind = 'receipt' and payment_date between p_from and p_to),
    'expenses', (select coalesce(sum(amount), 0)::text from public.expenses where expense_date between p_from and p_to),
    'tds_payable', (select coalesce(sum(tds_amount), 0)::text from public.expenses where expense_date between p_from and p_to),
    'total_invoiced', ((select coalesce(sum(grand_total), 0) from public.invoices
                        where status = 'issued' and invoice_date between p_from and p_to)
                       - (select coalesce(sum(grand_total), 0) from public.credit_notes
                          where status = 'issued' and credit_note_date between p_from and p_to))::text,
    -- As of today, not the period
    'outstanding', (select coalesce(sum(balance), 0)::text from open_bal),
    'outstanding_count', (select count(*) from open_bal),
    'overdue', (select coalesce(sum(balance), 0)::text from open_bal where due_date < public.ist_today()),
    'overdue_count', (select count(*) from open_bal where due_date < public.ist_today()),
    'client_credit', (select coalesce(sum(public.client_credit(c)), 0)::text from public.clients c),
    'pending_payments', (select coalesce(sum(amount + tds_amount), 0)::text from public.payments where status = 'pending' and kind = 'receipt'),
    'pending_payments_count', (select count(*) from public.payments where status = 'pending' and kind = 'receipt'),
    -- Owner's account in the period (§21.1); null without owner.view so a partial balance is never shown.
    'drawings', case when public.has_permission('owner.view') then
                  (select coalesce(sum(amount), 0)::text from public.owner_transactions where kind = 'drawing' and txn_date between p_from and p_to) end,
    'capital', case when public.has_permission('owner.view') then
                 (select coalesce(sum(amount), 0)::text from public.owner_transactions where kind = 'capital' and txn_date between p_from and p_to) end,
    -- Company balance as of today: cash in (receipts excl. TDS the client kept) − refunds − expenses (full bill: TDS
    -- withheld is owed to the government) − drawings + capital, from the opening balance date.
    'balance', case when public.has_permission('owner.view') then
                 (select (cs.opening_balance
                   + (select coalesce(sum(case when kind = 'receipt' then amount else -amount end), 0) from pay where payment_date >= cs.opening_balance_date)
                   - (select coalesce(sum(amount), 0) from public.expenses where expense_date >= cs.opening_balance_date)
                   + (select coalesce(sum(case when kind = 'capital' then amount else -amount end), 0)
                      from public.owner_transactions where txn_date >= cs.opening_balance_date))::text
                  from cs) end,
    'opening_balance_date', (select opening_balance_date from cs),
    -- Unpaid invoices by days since the invoice date (due dates are optional, §15)
    'ageing', (select jsonb_build_object(
                 '0_30', coalesce(sum(balance) filter (where public.ist_today() - invoice_date <= 30), 0)::text,
                 '31_60', coalesce(sum(balance) filter (where public.ist_today() - invoice_date between 31 and 60), 0)::text,
                 '61_90', coalesce(sum(balance) filter (where public.ist_today() - invoice_date between 61 and 90), 0)::text,
                 '90_plus', coalesce(sum(balance) filter (where public.ist_today() - invoice_date > 90), 0)::text)
               from open_bal),
    'monthly', (select jsonb_agg(jsonb_build_object(
                  'month', to_char(m, 'YYYY-MM'),
                  'revenue', (select coalesce(sum(case when kind = 'receipt' then amount + tds_amount else -amount end), 0)::text
                              from pay where date_trunc('month', payment_date) = m),
                  'expenses', (select coalesce(sum(amount), 0)::text from public.expenses where date_trunc('month', expense_date) = m))
                  order by m)
                from months)
  );
$$;
