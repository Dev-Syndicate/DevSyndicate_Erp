-- Report aggregates (PRD §27, v1.4). Security invoker: RLS decides what each user sees (payments.view,
-- expenses.view, invoices.view…). Row-level registers are read with plain selects in the app.

-- Revenue and expenses per month of the period (§9.2): cash received, TDS, refunds, expenses.
create function public.report_monthly(p_from date, p_to date)
returns table (month text, received numeric, tds numeric, refunds numeric, expenses numeric)
language sql stable security invoker set search_path = '' as $$
  with months as (
    select m::date as m, greatest(m::date, p_from) as s, least((m + interval '1 month - 1 day')::date, p_to) as e
    from generate_series(date_trunc('month', p_from), date_trunc('month', p_to), interval '1 month') m
  )
  select to_char(m, 'YYYY-MM'),
    coalesce((select sum(amount) from public.payments where status = 'confirmed' and kind = 'receipt' and payment_date between s and e), 0),
    coalesce((select sum(tds_amount) from public.payments where status = 'confirmed' and kind = 'receipt' and payment_date between s and e), 0),
    coalesce((select sum(amount) from public.payments where status = 'confirmed' and kind = 'refund' and payment_date between s and e), 0),
    coalesce((select sum(amount) from public.expenses where expense_date between s and e), 0)
  from months order by m;
$$;

-- Revenue per client (Zoho: Sales by Customer).
create function public.report_revenue_by_client(p_from date, p_to date)
returns table (client_id uuid, client text, received numeric, tds numeric, refunds numeric)
language sql stable security invoker set search_path = '' as $$
  select c.id, c.company_name,
    coalesce(sum(p.amount) filter (where p.kind = 'receipt'), 0),
    coalesce(sum(p.tds_amount) filter (where p.kind = 'receipt'), 0),
    coalesce(sum(p.amount) filter (where p.kind = 'refund'), 0)
  from public.payments p join public.clients c on c.id = p.client_id
  where p.status = 'confirmed' and p.payment_date between p_from and p_to
  group by c.id, c.company_name
  order by sum(case when p.kind = 'receipt' then p.amount + p.tds_amount else -p.amount end) desc, c.company_name;
$$;

-- Expenses per category.
create function public.report_expenses_by_category(p_from date, p_to date)
returns table (category text, count bigint, amount numeric, gst numeric, tds numeric)
language sql stable security invoker set search_path = '' as $$
  select c.name, count(*), sum(e.amount), sum(e.gst_amount), sum(e.tds_amount)
  from public.expenses e join public.expense_categories c on c.id = e.category_id
  where e.expense_date between p_from and p_to
  group by c.name
  order by 3 desc, c.name;
$$;

-- GST per month: output tax on issued invoices − issued credit notes (by document date), input tax claimed and
-- reverse-charge tax on expenses (by expense date). For reference; filing happens on the GST portal.
create function public.report_tax_summary(p_from date, p_to date)
returns table (month text, taxable numeric, cgst numeric, sgst numeric, igst numeric, input_gst numeric, reverse_charge_gst numeric)
language sql stable security invoker set search_path = '' as $$
  with months as (
    select m::date as m, greatest(m::date, p_from) as s, least((m + interval '1 month - 1 day')::date, p_to) as e
    from generate_series(date_trunc('month', p_from), date_trunc('month', p_to), interval '1 month') m
  ),
  docs as (
    select invoice_date as d, taxable_total, cgst_total, sgst_total, igst_total from public.invoices where status = 'issued'
    union all
    select credit_note_date, -taxable_total, -cgst_total, -sgst_total, -igst_total from public.credit_notes where status = 'issued'
  )
  select to_char(m, 'YYYY-MM'),
    coalesce((select sum(taxable_total) from docs where d between s and e), 0),
    coalesce((select sum(cgst_total) from docs where d between s and e), 0),
    coalesce((select sum(sgst_total) from docs where d between s and e), 0),
    coalesce((select sum(igst_total) from docs where d between s and e), 0),
    coalesce((select sum(gst_amount) from public.expenses where itc_eligible and expense_date between s and e), 0),
    coalesce((select sum(gst_amount) from public.expenses where reverse_charge and expense_date between s and e), 0)
  from months order by m;
$$;

revoke execute on function public.report_monthly, public.report_revenue_by_client, public.report_expenses_by_category,
  public.report_tax_summary from public, anon;
grant execute on function public.report_monthly, public.report_revenue_by_client, public.report_expenses_by_category,
  public.report_tax_summary to authenticated;
