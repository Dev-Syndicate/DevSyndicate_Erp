-- Dashboard figures (PRD §9.2, §10, §36; v1.4). Security invoker: RLS decides what each user sees, so a user
-- without payments.view / expenses.view / invoices.view gets zeros. Amounts are returned as text (no JS floats).

create function public.dashboard(p_from date, p_to date) returns jsonb
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
  months as (select generate_series(fy.start, fy.start + interval '11 months', interval '1 month')::date as m from fy)
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

revoke execute on function public.dashboard from public, anon;
grant execute on function public.dashboard to authenticated;
