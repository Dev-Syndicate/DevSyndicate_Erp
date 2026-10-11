-- Self-check for expenses (PRD §21, v1.4): numbering, validation, GST fields only when GST-registered,
-- reverse charge, TDS, archived categories, receipts, permissions. Runs inside a transaction and rolls back.
begin;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
select gen_random_uuid(), r.key || '@test.local', jsonb_build_object('role_id', r.id), '{}', 'authenticated', 'authenticated'
from public.roles r where r.key in ('super_admin', 'staff');
create temp table u as select email, id from public.profiles where email like '%@test.local';
grant select on u to authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'super_admin@test.local'), 'role', 'authenticated')::text, true);

update public.company_settings set gst_registered = false;
insert into public.vendors (organization_id, name) values (public.current_org_id(), 'Exp Vendor');

set local role authenticated;
do $$
declare
  hosting uuid := (select id from public.expense_categories where name = 'Hosting');
  ven uuid := (select id from public.vendors where name = 'Exp Vendor');
  e1 uuid; e2 uuid; e public.expenses;
  base jsonb;
begin
  base := jsonb_build_object('category_id', hosting, 'vendor_id', ven, 'description', 'AWS October', 'amount', 11800,
                             'gst_amount', 1800, 'itc_eligible', true, 'method', 'credit_card');

  -- Not GST-registered: number assigned, GST fields dropped
  e1 := public.save_expense(null, base);
  select * into e from public.expenses where id = e1;
  assert e.number like 'EXP%' and e.amount = 11800 and e.vendor_id = ven, 'expense saved with a number';
  assert e.gst_amount = 0 and not e.itc_eligible and not e.reverse_charge, 'no GST fields without registration';

  -- GST-registered: GST and ITC kept; reverse charge puts GST on top of the amount
  update public.company_settings set gst_registered = true, gstin = '33ABCDE1234F1Z5', state = 'Tamil Nadu' where organization_id = public.current_org_id();
  perform public.save_expense(e1, base);
  select * into e from public.expenses where id = e1;
  assert e.gst_amount = 1800 and e.itc_eligible and e.number = (select number from public.expenses where id = e1), 'GST kept, number unchanged';
  e2 := public.save_expense(null, base || jsonb_build_object('amount', 10000, 'gst_amount', 1800, 'reverse_charge', true));
  assert (select reverse_charge and gst_amount = 1800 from public.expenses where id = e2), 'reverse charge';
  assert (select number from public.expenses where id = e2) <> e.number, 'each expense gets its own number';

  -- TDS withheld from the vendor
  perform public.save_expense(e2, base || jsonb_build_object('amount', 50000, 'gst_amount', 0, 'tds_amount', 5000));
  assert (select tds_amount = 5000 and gst_amount = 0 and not itc_eligible from public.expenses where id = e2), 'TDS saved, ITC needs GST';

  -- Validation
  begin
    perform public.save_expense(null, base || jsonb_build_object('gst_amount', 11800));
    assert false, 'GST must be below the total';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_expense(null, base || jsonb_build_object('tds_amount', 11800));
    assert false, 'TDS must be below the amount';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_expense(null, base || jsonb_build_object('expense_date', public.ist_today() + 1));
    assert false, 'no future dates';
  exception when invalid_parameter_value then null; end;

  -- Archived category: kept on existing expenses, refused for new ones
  update public.expense_categories set is_active = false where id = hosting;
  perform public.save_expense(e1, base);
  begin
    perform public.save_expense(null, base);
    assert false, 'archived category refused for new expenses';
  exception when invalid_parameter_value then null; end;

  -- Receipts follow expense permissions; deleting works
  insert into public.documents (organization_id, entity_type, entity_id, path, file_name, mime_type, size_bytes)
  values (public.current_org_id(), 'expense', e1, public.current_org_id() || '/expense/' || e1 || '/bill.pdf', 'bill.pdf', 'application/pdf', 900);
  insert into storage.objects (bucket_id, name) values ('documents', public.current_org_id() || '/expense/' || e1 || '/bill.pdf');
  delete from public.documents where entity_id = e1;
  delete from public.expenses where id = e1;
  assert not exists (select 1 from public.expenses where id = e1), 'expense deleted';
end $$;

-- Staff: no access to expenses
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'staff@test.local'), 'role', 'authenticated')::text, true);
do $$ begin
  assert (select count(*) from public.expenses) = 0, 'staff cannot view expenses';
  assert (select count(*) from public.documents where entity_type = 'expense') = 0, 'staff cannot view receipts';
  begin
    perform public.save_expense(null, jsonb_build_object('category_id', (select id from public.expense_categories limit 1),
      'description', 'x', 'amount', 1, 'method', 'cash'));
    assert false, 'staff cannot record expenses';
  exception when insufficient_privilege then null; end;
end $$;

select 'expense checks passed' as result;
rollback;
