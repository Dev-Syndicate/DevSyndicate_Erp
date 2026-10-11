-- Self-check for the dashboard function (PRD §9.2, §10): each figure moves by what one invoice, payment and
-- expense add (deltas, so existing data doesn't matter); users without finance permissions see zeros. Rolls back.
begin;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
select gen_random_uuid(), r.key || '@test.local', jsonb_build_object('role_id', r.id), '{}', 'authenticated', 'authenticated'
from public.roles r where r.key in ('super_admin', 'staff');
create temp table u as select email, id from public.profiles where email like '%@test.local';
grant select on u to authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'super_admin@test.local'), 'role', 'authenticated')::text, true);

update public.company_settings set gst_registered = false, round_off = true;
insert into public.clients (organization_id, company_name, state, country)
values (public.current_org_id(), 'Dash Co', 'Tamil Nadu', 'India');

set local role authenticated;
do $$
declare
  cid uuid := (select id from public.clients where company_name = 'Dash Co');
  t date := public.ist_today();
  b jsonb := public.dashboard(t, t);
  a jsonb;
  inv uuid; pay uuid;
  d numeric;
begin
  inv := public.save_invoice(null, jsonb_build_object('client_id', cid,
           'items', '[{"description": "Website", "quantity": 1, "unit_price": 10000}]'::jsonb));
  perform public.invoice_action(inv, 'issue');
  pay := public.save_payment(null, jsonb_build_object('client_id', cid, 'amount', 4000, 'tds_amount', 1000, 'method', 'upi',
           'allocations', jsonb_build_array(jsonb_build_object('invoice_id', inv, 'amount', 5000))));
  perform public.payment_action(pay, 'confirm');
  perform public.save_payment(null, jsonb_build_object('client_id', cid, 'amount', 500, 'method', 'cash'));
  perform public.save_expense(null, jsonb_build_object('category_id', (select id from public.expense_categories where is_active limit 1),
           'description', 'Hosting', 'amount', 3000, 'tds_amount', 300, 'method', 'upi'));

  a := public.dashboard(t, t);
  assert (a->>'revenue')::numeric - (b->>'revenue')::numeric = 5000, 'revenue = cash + TDS';
  assert (a->>'tds_receivable')::numeric - (b->>'tds_receivable')::numeric = 1000, 'TDS receivable';
  assert (a->>'expenses')::numeric - (b->>'expenses')::numeric = 3000, 'expenses = bill total';
  assert (a->>'tds_payable')::numeric - (b->>'tds_payable')::numeric = 300, 'TDS payable';
  assert (a->>'total_invoiced')::numeric - (b->>'total_invoiced')::numeric = 10000, 'total invoiced';
  assert (a->>'outstanding')::numeric - (b->>'outstanding')::numeric = 5000, 'outstanding = balance';
  assert (a->'ageing'->>'0_30')::numeric - (b->'ageing'->>'0_30')::numeric = 5000, 'new invoice in 0-30 days';
  assert (a->>'pending_payments')::numeric - (b->>'pending_payments')::numeric = 500, 'pending payments';
  assert (a->>'overdue')::numeric = (b->>'overdue')::numeric, 'no due date, not overdue';
  assert jsonb_array_length(a->'monthly') = 12, 'twelve months of the financial year';
  select (m->>'revenue')::numeric into d from jsonb_array_elements(a->'monthly') m where m->>'month' = to_char(t, 'YYYY-MM');
  assert d >= 5000, 'this month in the chart';
end $$;

-- Staff: no finance permissions, so every figure is zero
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'staff@test.local'), 'role', 'authenticated')::text, true);
do $$
declare a jsonb := public.dashboard(public.ist_today() - 365, public.ist_today());
begin
  assert a->>'revenue' = '0' and a->>'expenses' = '0' and a->>'outstanding' = '0' and a->>'client_credit' = '0', 'staff sees no figures';
end $$;

select 'dashboard checks passed' as result;
rollback;
