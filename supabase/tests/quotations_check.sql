-- Self-check for quotations: totals (PRD §9.3) and lifecycle. Runs inside a transaction and rolls back.
-- The totals cases are mirrored in src/lib/money.test.mjs.
begin;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
select gen_random_uuid(), r.key || '@test.local', jsonb_build_object('role_id', r.id), '{}', 'authenticated', 'authenticated'
from public.roles r where r.key in ('super_admin', 'staff');
create temp table u as select email, id from public.profiles where email like '%@test.local';
grant select on u to authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'super_admin@test.local'), 'role', 'authenticated')::text, true);

update public.company_settings set state = 'Tamil Nadu', gst_registered = true, gstin = '33ABCDE1234F1Z5', round_off = true;
insert into public.clients (organization_id, company_name, state, country) values
  (public.current_org_id(), 'Intra Co', 'Tamil Nadu', 'India'),
  (public.current_org_id(), 'Inter Co', 'Karnataka', 'India'),
  (public.current_org_id(), 'Export Co', '', 'USA');

create temp table items as select '[
  {"description": "Website design", "timeline": "2 days", "quantity": 1, "unit_price": 25000, "discount_type": "percent", "discount_value": 10, "tax_rate": 18},
  {"description": "Hosting", "quantity": 12, "unit_price": 499.99, "tax_rate": 18}
]'::jsonb as j;
grant select on items to authenticated;

set local role authenticated;
do $$
declare
  intra uuid; inter uuid; export uuid; rem uuid; rev uuid; q public.quotations;
  base jsonb := jsonb_build_object('valid_until', public.ist_today() + 15, 'title', 'SIPLINK Website',
                                   'discount_type', 'amount', 'discount_value', 1000, 'items', (select j from items));
begin
  -- Intra-state: CGST + SGST, rounded to the rupee
  intra := public.save_quotation(null, base || jsonb_build_object('client_id', (select id from public.clients where company_name = 'Intra Co')));
  select * into q from public.quotations where id = intra;
  assert q.supply_type = 'intra' and q.status = 'draft' and q.number is null, 'intra draft';
  assert q.subtotal = 28499.88 and q.discount_total = 1000 and q.taxable_total = 27499.88, 'intra subtotal/discount/taxable';
  assert q.cgst_total = 2474.99 and q.sgst_total = 2474.98 and q.igst_total = 0, 'intra CGST/SGST split';
  assert q.round_off = 0.15 and q.grand_total = 32450.00, 'intra round off and total';
  assert (select allocated_discount from public.quotation_items where quotation_id = intra and position = 1) = 789.48, 'pro-rata allocation';

  -- Inter-state: IGST
  inter := public.save_quotation(null, base || jsonb_build_object('client_id', (select id from public.clients where company_name = 'Inter Co')));
  select * into q from public.quotations where id = inter;
  assert q.supply_type = 'inter' and q.igst_total = 4949.97 and q.cgst_total = 0 and q.grand_total = 32450.00, 'inter IGST';

  -- Export: zero-rated
  export := public.save_quotation(null, base || jsonb_build_object('client_id', (select id from public.clients where company_name = 'Export Co')));
  select * into q from public.quotations where id = export;
  assert q.supply_type = 'export' and q.taxable_total = 27499.88 and q.igst_total = 0 and q.grand_total = 27500.00 and q.round_off = 0.12, 'export zero-rated';

  -- Rounding remainder of the document discount goes to the last line
  rem := public.save_quotation(null, jsonb_build_object(
    'client_id', (select id from public.clients where company_name = 'Intra Co'), 'valid_until', public.ist_today() + 15,
    'title', 'Remainder', 'discount_type', 'amount', 'discount_value', 100, 'items', '[
      {"description": "A", "quantity": 1, "unit_price": 100}, {"description": "B", "quantity": 1, "unit_price": 100},
      {"description": "C", "quantity": 1, "unit_price": 100}]'::jsonb));
  assert (select array_agg(allocated_discount order by position) from public.quotation_items where quotation_id = rem) = array[33.33, 33.33, 33.34]::numeric[], 'remainder to last line';

  -- Validation
  begin
    perform public.save_quotation(null, base || jsonb_build_object('client_id', (select id from public.clients where company_name = 'Intra Co'), 'discount_value', 999999));
    assert false, 'discount larger than subtotal';
  exception when invalid_parameter_value then null; end;

  -- Lifecycle: send assigns a number, revise keeps it, sending the revision supersedes the original
  perform public.quotation_action(intra, 'send');
  select * into q from public.quotations where id = intra;
  assert q.status = 'sent' and q.number is not null, 'send assigns number';
  begin
    perform public.save_quotation(intra, base || jsonb_build_object('client_id', q.client_id));
    assert false, 'sent quotations are locked';
  exception when invalid_parameter_value then null; end;
  rev := public.quotation_action(intra, 'revise');
  assert (select number = q.number and revision = 2 and status = 'draft' from public.quotations where id = rev), 'revision keeps number';
  assert (select grand_total from public.quotations where id = rev) = 32450.00, 'revision copies lines';
  assert (select timeline from public.quotation_items where quotation_id = rev and position = 1) = '2 days', 'revision copies timeline';
  perform public.quotation_action(rev, 'send');
  assert (select status from public.quotations where id = intra) = 'superseded', 'original superseded';
  perform public.quotation_action(rev, 'accept');
  assert (select status from public.quotations where id = rev) = 'accepted', 'accepted';

  -- Extend validity: sent quotations only, not into the past
  perform public.quotation_action(inter, 'send');
  perform public.extend_quotation_validity(inter, public.ist_today() + 30);
  assert (select valid_until from public.quotations where id = inter) = public.ist_today() + 30, 'validity extended';
  begin
    perform public.extend_quotation_validity(inter, public.ist_today() - 1);
    assert false, 'no past validity';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.extend_quotation_validity(export, public.ist_today() + 30);
    assert false, 'drafts cannot be extended';
  exception when invalid_parameter_value then null; end;
end $$;

-- Staff can create drafts but not send, edit or accept
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'staff@test.local'), 'role', 'authenticated')::text, true);
do $$
declare d uuid;
begin
  d := public.save_quotation(null, jsonb_build_object(
    'client_id', (select id from public.clients where company_name = 'Intra Co'), 'valid_until', public.ist_today() + 15,
    'title', 'Staff draft', 'items', '[{"description": "X", "quantity": 1, "unit_price": 10}]'::jsonb));
  begin
    perform public.quotation_action(d, 'send');
    assert false, 'staff cannot send';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_quotation(d, jsonb_build_object('client_id', (select id from public.clients where company_name = 'Intra Co'),
      'valid_until', public.ist_today() + 15, 'title', 'Edit', 'items', '[{"description": "X", "quantity": 1, "unit_price": 10}]'::jsonb));
    assert false, 'staff cannot edit';
  exception when insufficient_privilege then null; end;
end $$;

select 'quotation checks passed' as result;
rollback;
