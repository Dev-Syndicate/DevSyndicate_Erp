-- Self-check for invoices: totals, issue (number + snapshot + lock), quotation conversion and its cap,
-- cancel, duplicate, permissions. Runs inside a transaction and rolls back.
begin;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
select gen_random_uuid(), r.key || '@test.local', jsonb_build_object('role_id', r.id), '{}', 'authenticated', 'authenticated'
from public.roles r where r.key in ('super_admin', 'staff');
create temp table u as select email, id from public.profiles where email like '%@test.local';
grant select on u to authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'super_admin@test.local'), 'role', 'authenticated')::text, true);

update public.company_settings set state = 'Tamil Nadu', gst_registered = true, gstin = '33ABCDE1234F1Z5', round_off = true;
insert into public.clients (organization_id, company_name, billing_address, city, state, country, gstin, payment_terms_days)
values (public.current_org_id(), 'Intra Co', '1 Main Road', 'Chennai', 'Tamil Nadu', 'India', '33ABCDE1234F1Z5', 30);

create temp table items as select '[
  {"description": "Website design", "quantity": 1, "unit_price": 25000, "discount_type": "percent", "discount_value": 10, "tax_rate": 18},
  {"description": "Hosting", "quantity": 12, "unit_price": 499.99, "tax_rate": 18}
]'::jsonb as j;
grant select on items to authenticated;

set local role authenticated;
do $$
declare
  cid uuid := (select id from public.clients where company_name = 'Intra Co');
  qid uuid; a uuid; b uuid; c uuid; d uuid; inv public.invoices; h text;
  base jsonb := jsonb_build_object('client_id', (select id from public.clients where company_name = 'Intra Co'),
                                   'discount_type', 'amount', 'discount_value', 1000, 'items', (select j from items));
begin
  -- Direct invoice: same totals as the matching quotation
  a := public.save_invoice(null, base || jsonb_build_object('due_date', public.ist_today() + 30));
  select * into inv from public.invoices where id = a;
  assert inv.status = 'draft' and inv.number is null and inv.supply_type = 'intra', 'draft';
  assert inv.taxable_total = 27499.88 and inv.cgst_total = 2474.99 and inv.sgst_total = 2474.98 and inv.grand_total = 32450.00, 'invoice totals';

  -- Issue: number, snapshot, lock
  perform public.invoice_action(a, 'issue');
  select * into inv from public.invoices where id = a;
  assert inv.status = 'issued' and inv.number is not null and inv.issued_at is not null, 'issue assigns number';
  assert inv.billing_name = 'Intra Co' and inv.billing_address = '1 Main Road, Chennai, Tamil Nadu, India'
     and inv.billing_gstin = '33ABCDE1234F1Z5', 'billing snapshot';
  begin
    perform public.save_invoice(a, base || jsonb_build_object('due_date', public.ist_today() + 30));
    assert false, 'issued invoices are locked';
  exception when invalid_parameter_value then null; end;
  perform public.invoice_action(a, 'cancel');
  assert (select status = 'cancelled' and number = inv.number from public.invoices where id = a), 'cancel keeps the number';

  -- Duplicate: new draft with the same lines
  d := public.invoice_action(a, 'duplicate');
  assert (select status = 'draft' and grand_total = 32450.00 from public.invoices where id = d), 'duplicate';

  -- Conversion: 50% advance + 50% on delivery fills the quotation exactly
  qid := public.save_quotation(null, base || jsonb_build_object('valid_until', public.ist_today() + 15, 'title', 'SIPLINK Website'));
  begin
    perform public.convert_quotation(qid, 'full');
    assert false, 'only accepted quotations convert';
  exception when invalid_parameter_value then null; end;
  perform public.quotation_action(qid, 'send');
  perform public.quotation_action(qid, 'accept');

  b := public.convert_quotation(qid, 'percent', 50);
  select * into inv from public.invoices where id = b;
  assert inv.quotation_id = qid and inv.due_date = public.ist_today() + 30, 'conversion links quotation, client terms';
  assert inv.taxable_total = 13749.94 and inv.grand_total = 16225.00, 'half of the quotation';
  assert (select description from public.invoice_items where invoice_id = b and position = 1) = '50% — Website design', '% line label';
  perform public.invoice_action(b, 'issue');
  c := public.convert_quotation(qid, 'percent', 50);
  perform public.invoice_action(c, 'issue');
  assert (select public.invoiced_total(q) from public.quotations q where q.id = qid) = 32450.00, 'fully invoiced';

  -- Specific amount: one line before GST, at the quotation's single tax rate
  d := public.convert_quotation(qid, 'amount', null, null, 1000);
  assert (select taxable_total = 1000.00 and grand_total = 1180.00 from public.invoices where id = d), 'amount mode adds GST on top';
  assert (select description from public.invoice_items where invoice_id = d) = 'Part payment — SIPLINK Website', 'amount line label';
  delete from public.invoices where id = d;

  -- Past the quotation total: needs a reason
  d := public.convert_quotation(qid, 'items', null, jsonb_build_array(jsonb_build_object(
         'id', (select id from public.quotation_items where quotation_id = qid and position = 2), 'quantity', 1)));
  assert (select grand_total from public.invoices where id = d) = 569.00, 'selected item with its discount share, rounded';
  begin
    perform public.invoice_action(d, 'issue');
    assert false, 'cap needs a reason';
  exception when invalid_parameter_value then
    get stacked diagnostics h = pg_exception_hint;
    assert h = 'override_reason', 'hint asks for a reason';
  end;
  perform public.invoice_action(d, 'issue', 'Extra month of hosting agreed by email');
  assert (select over_quotation_reason from public.invoices where id = d) = 'Extra month of hosting agreed by email', 'reason stored';
end $$;

-- Staff: no invoice access
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'staff@test.local'), 'role', 'authenticated')::text, true);
do $$ begin
  assert (select count(*) from public.invoices) = 0, 'staff cannot view invoices';
  begin
    perform public.save_invoice(null, jsonb_build_object('client_id', (select id from public.clients where company_name = 'Intra Co'),
      'due_date', public.ist_today(), 'items', '[{"description": "X", "quantity": 1, "unit_price": 10}]'::jsonb));
    assert false, 'staff cannot create invoices';
  exception when insufficient_privilege then null; end;
end $$;

select 'invoice checks passed' as result;
rollback;
