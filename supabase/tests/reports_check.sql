-- Self-check for the report functions (PRD §27): each figure moves by what one GST invoice, credit note, payment,
-- refund and expense add (deltas, so existing data doesn't matter); staff see nothing. Rolls back.
begin;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
select gen_random_uuid(), r.key || '@test.local', jsonb_build_object('role_id', r.id), '{}', 'authenticated', 'authenticated'
from public.roles r where r.key in ('super_admin', 'staff');
create temp table u as select email, id from public.profiles where email like '%@test.local';
grant select on u to authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'super_admin@test.local'), 'role', 'authenticated')::text, true);

update public.company_settings set state = 'Tamil Nadu', gst_registered = true, gstin = '33ABCDE1234F1Z5', round_off = true;
insert into public.clients (organization_id, company_name, state, country)
values (public.current_org_id(), 'Report Co', 'Tamil Nadu', 'India');

set local role authenticated;
do $$
declare
  cid uuid := (select id from public.clients where company_name = 'Report Co');
  t date := public.ist_today();
  m text := to_char(public.ist_today(), 'YYYY-MM');
  b record; a record; bt record; at record; c record;
  inv uuid; pay uuid;
begin
  select * into b from public.report_monthly(t, t) where month = m;
  select * into bt from public.report_tax_summary(t, t) where month = m;

  inv := public.save_invoice(null, jsonb_build_object('client_id', cid,
           'items', '[{"description": "Website", "quantity": 1, "unit_price": 10000, "tax_rate": 18}]'::jsonb));
  perform public.invoice_action(inv, 'issue');
  perform public.credit_note_action(public.save_credit_note(null, jsonb_build_object('invoice_id', inv, 'reason', 'Discount',
    'items', '[{"description": "Discount", "quantity": 1, "unit_price": 1000, "tax_rate": 18}]'::jsonb)), 'issue');
  pay := public.save_payment(null, jsonb_build_object('client_id', cid, 'amount', 9000, 'tds_amount', 900, 'method', 'upi'));
  perform public.payment_action(pay, 'confirm');
  perform public.payment_action(public.save_payment(null, jsonb_build_object('client_id', cid, 'kind', 'refund', 'amount', 500,
    'method', 'upi')), 'confirm');
  perform public.save_expense(null, jsonb_build_object('category_id', (select id from public.expense_categories where name = 'Software'),
    'description', 'AWS', 'amount', 1180, 'gst_amount', 180, 'itc_eligible', true, 'tds_amount', 0, 'method', 'credit_card'));

  select * into a from public.report_monthly(t, t) where month = m;
  assert a.received - b.received = 9000 and a.tds - b.tds = 900 and a.refunds - b.refunds = 500, 'monthly revenue parts';
  assert a.expenses - b.expenses = 1180, 'monthly expenses';

  select * into c from public.report_revenue_by_client(t, t) where client_id = cid;
  assert c.received = 9000 and c.tds = 900 and c.refunds = 500, 'revenue by client';
  assert (select amount >= 1180 and gst >= 180 from public.report_expenses_by_category(t, t) where category = 'Software'), 'expenses by category';

  select * into at from public.report_tax_summary(t, t) where month = m;
  assert at.taxable - bt.taxable = 9000, 'taxable = invoice − credit note';
  assert at.cgst - bt.cgst = 810 and at.sgst - bt.sgst = 810 and at.igst = bt.igst, 'intra-state CGST/SGST net of the credit note';
  assert at.input_gst - bt.input_gst = 180, 'input GST claimed';
end $$;

-- Staff: no finance permissions, so the reports are empty
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'staff@test.local'), 'role', 'authenticated')::text, true);
do $$ begin
  assert not exists (select 1 from public.report_revenue_by_client(public.ist_today() - 365, public.ist_today())), 'staff see no revenue';
  assert (select sum(received) + sum(expenses) from public.report_monthly(public.ist_today() - 30, public.ist_today())) = 0, 'staff see no totals';
end $$;

select 'report checks passed' as result;
rollback;
