-- Self-check for the owner's account and company balance (PRD §21.1, v1.5): drawings and capital change the balance
-- but never expenses or profit, opening balance and date, validation, proofs, permissions. Rolls back.
begin;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
select gen_random_uuid(), r.key || '@test.local', jsonb_build_object('role_id', r.id), '{}', 'authenticated', 'authenticated'
from public.roles r where r.key in ('super_admin', 'staff');
create temp table u as select email, id from public.profiles where email like '%@test.local';
grant select on u to authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'super_admin@test.local'), 'role', 'authenticated')::text, true);

insert into public.clients (organization_id, company_name) values (public.current_org_id(), 'Owner Test Co');

set local role authenticated;
do $$
declare
  today date := public.ist_today();
  d0 jsonb := public.dashboard(today, today);
  bal0 numeric := (d0->>'balance')::numeric;
  open_date date := (d0->>'opening_balance_date')::date;
  d jsonb;
  dr uuid; cap uuid; pay uuid;
begin
  assert bal0 is not null, 'super admin sees the balance';

  -- Drawing out, capital in: balance moves, expenses and revenue don't
  dr := public.save_owner_transaction(null, jsonb_build_object('kind', 'drawing', 'txn_date', today, 'amount', 2000, 'method', 'cash'));
  cap := public.save_owner_transaction(null, jsonb_build_object('kind', 'capital', 'txn_date', today, 'amount', 500, 'method', 'upi', 'reference', ' 4123 '));
  d := public.dashboard(today, today);
  assert (d->>'balance')::numeric = bal0 - 1500, 'balance = before − drawing + capital';
  assert (d->>'drawings')::numeric = (d0->>'drawings')::numeric + 2000, 'drawings in the period';
  assert (d->>'capital')::numeric = (d0->>'capital')::numeric + 500, 'capital in the period';
  assert d->>'expenses' = d0->>'expenses' and d->>'revenue' = d0->>'revenue', 'drawings are not expenses or revenue';
  assert (select reference from public.owner_transactions where id = cap) = '4123', 'reference trimmed';

  -- Receipt adds the cash received (TDS the client kept is not cash); an expense subtracts the full bill
  pay := public.save_payment(null, jsonb_build_object('client_id', (select id from public.clients where company_name = 'Owner Test Co'),
           'amount', 9000, 'tds_amount', 1000, 'method', 'upi'));
  perform public.payment_action(pay, 'confirm');
  perform public.save_expense(null, jsonb_build_object('category_id', (select id from public.expense_categories where name = 'Hosting'),
    'description', 'Owner test', 'amount', 700, 'tds_amount', 70, 'method', 'upi'));
  assert (public.dashboard(today, today)->>'balance')::numeric = bal0 - 1500 + 9000 - 700, 'receipts in, expenses out';

  -- Edit, then validation
  perform public.save_owner_transaction(dr, jsonb_build_object('kind', 'drawing', 'txn_date', today, 'amount', 2500, 'method', 'cash'));
  assert (public.dashboard(today, today)->>'balance')::numeric = bal0 - 2000 + 9000 - 700, 'edited drawing';
  begin
    perform public.save_owner_transaction(null, jsonb_build_object('kind', 'drawing', 'txn_date', today + 1, 'amount', 1, 'method', 'cash'));
    assert false, 'no future dates';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_owner_transaction(null, jsonb_build_object('kind', 'drawing', 'amount', 0, 'method', 'cash'));
    assert false, 'amount must be positive';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_owner_transaction(null, jsonb_build_object('kind', 'salary', 'amount', 1, 'method', 'cash'));
    assert false, 'only drawing or capital';
  exception when invalid_parameter_value then null; end;

  -- Before the opening balance date: not counted
  perform public.save_owner_transaction(null, jsonb_build_object('kind', 'drawing', 'txn_date', open_date - 1, 'amount', 300, 'method', 'cash'));
  assert (public.dashboard(today, today)->>'balance')::numeric = bal0 - 2000 + 9000 - 700, 'before the opening date is ignored';

  -- Proofs; deleting works
  insert into public.documents (organization_id, entity_type, entity_id, path, file_name, mime_type, size_bytes)
  values (public.current_org_id(), 'owner', dr, public.current_org_id() || '/owner/' || dr || '/slip.jpg', 'slip.jpg', 'image/jpeg', 900);
  delete from public.documents where entity_id = dr;
  delete from public.owner_transactions where id = dr;
  assert not exists (select 1 from public.owner_transactions where id = dr), 'drawing deleted';
end $$;

-- Opening balance raises the balance one for one
reset role;
create temp table b0 as select (public.dashboard(public.ist_today(), public.ist_today())->>'balance')::numeric as b;
update public.company_settings set opening_balance = opening_balance + 1000;
do $$ begin
  assert (public.dashboard(public.ist_today(), public.ist_today())->>'balance')::numeric = (select b from b0) + 1000, 'opening balance counts';
end $$;
set local role authenticated;

-- Staff: no owner access and no balance
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'staff@test.local'), 'role', 'authenticated')::text, true);
do $$ begin
  assert (select count(*) from public.owner_transactions) = 0, 'staff cannot view owner transactions';
  assert public.dashboard(public.ist_today(), public.ist_today())->>'balance' is null, 'staff sees no balance';
  begin
    perform public.save_owner_transaction(null, jsonb_build_object('kind', 'drawing', 'amount', 1, 'method', 'cash'));
    assert false, 'staff cannot record drawings';
  exception when insufficient_privilege then null; end;
end $$;

select 'owner checks passed' as result;
rollback;
