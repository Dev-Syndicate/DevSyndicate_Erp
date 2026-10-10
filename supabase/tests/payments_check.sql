-- Self-check for payments (PRD §19, v1.2): TDS, allocations, advances and client credit, refunds, cancelling,
-- invoice cancel guard, proof documents, permissions. Runs inside a transaction and rolls back.
begin;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
select gen_random_uuid(), r.key || '@test.local', jsonb_build_object('role_id', r.id), '{}', 'authenticated', 'authenticated'
from public.roles r where r.key in ('super_admin', 'staff');
create temp table u as select email, id from public.profiles where email like '%@test.local';
grant select on u to authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'super_admin@test.local'), 'role', 'authenticated')::text, true);

update public.company_settings set gst_registered = false, round_off = true;
insert into public.clients (organization_id, company_name, state, country)
values (public.current_org_id(), 'Pay Co', 'Tamil Nadu', 'India');

set local role authenticated;
do $$
declare
  cid uuid := (select id from public.clients where company_name = 'Pay Co');
  item jsonb := '[{"description": "Website", "quantity": 1, "unit_price": 29000}]';
  inv1 uuid; inv2 uuid; p1 uuid; adv uuid; ref uuid; i public.invoices; c public.clients; pay public.payments;
begin
  inv1 := public.save_invoice(null, jsonb_build_object('client_id', cid, 'due_date', public.ist_today() + 15, 'items', item));
  perform public.invoice_action(inv1, 'issue');

  -- Receipt with TDS settles the invoice: ₹26,100 received + ₹2,900 TDS
  p1 := public.save_payment(null, jsonb_build_object('client_id', cid, 'kind', 'receipt', 'amount', 26100, 'tds_amount', 2900,
          'method', 'bank_transfer', 'allocations', jsonb_build_array(jsonb_build_object('invoice_id', inv1, 'amount', 29000))));
  select * into i from public.invoices where id = inv1;
  assert public.amount_paid(i) = 0, 'pending payments do not count';
  perform public.payment_action(p1, 'confirm');
  select * into i from public.invoices where id = inv1;
  assert public.amount_paid(i) = 29000 and public.balance_due(i) = 0, 'TDS + cash settle the invoice';
  assert (select number is not null and status = 'confirmed' from public.payments where id = p1), 'confirm assigns number';

  -- Paid invoices cannot be cancelled
  begin
    perform public.invoice_action(inv1, 'cancel');
    assert false, 'invoice with payments cannot be cancelled';
  exception when invalid_parameter_value then null; end;

  -- Over-allocation is refused
  begin
    perform public.save_payment(null, jsonb_build_object('client_id', cid, 'amount', 100, 'method', 'upi',
      'allocations', jsonb_build_array(jsonb_build_object('invoice_id', inv1, 'amount', 100))));
    assert false, 'cannot allocate past the balance';
  exception when invalid_parameter_value then null; end;

  -- Advance: no allocation → client credit, applied later to a full invoice
  adv := public.save_payment(null, jsonb_build_object('client_id', cid, 'amount', 10000, 'method', 'upi'));
  perform public.payment_action(adv, 'confirm');
  select * into c from public.clients where id = cid;
  assert public.client_credit(c) = 10000, 'advance becomes client credit';
  inv2 := public.save_invoice(null, jsonb_build_object('client_id', cid, 'due_date', public.ist_today() + 15, 'items', item));
  perform public.invoice_action(inv2, 'issue');
  perform public.apply_payment(adv, inv2, 10000);
  select * into i from public.invoices where id = inv2;
  select * into c from public.clients where id = cid;
  assert public.balance_due(i) = 19000 and public.client_credit(c) = 0, 'applied advance reduces the balance';
  begin
    perform public.apply_payment(adv, inv2, 1);
    assert false, 'cannot apply more than the receipt';
  exception when invalid_parameter_value then null; end;

  -- Unapply returns it to credit; refunds are limited to credit
  perform public.unapply_payment((select id from public.payment_allocations where payment_id = adv));
  select * into c from public.clients where id = cid;
  assert public.client_credit(c) = 10000, 'unapplied amount returns to credit';
  ref := public.save_payment(null, jsonb_build_object('client_id', cid, 'kind', 'refund', 'amount', 10001, 'method', 'bank_transfer'));
  begin
    perform public.payment_action(ref, 'confirm');
    assert false, 'refund limited to credit';
  exception when invalid_parameter_value then null; end;
  ref := public.save_payment(ref, jsonb_build_object('client_id', cid, 'kind', 'refund', 'amount', 4000, 'method', 'bank_transfer'));
  perform public.payment_action(ref, 'confirm');
  select * into c from public.clients where id = cid;
  assert public.client_credit(c) = 6000, 'refund reduces credit';

  -- Cancelling needs a reason, and is blocked when the credit was refunded
  begin
    perform public.payment_action(adv, 'cancel');
    assert false, 'cancel needs a reason';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.payment_action(adv, 'cancel', 'Entered twice');
    assert false, 'refunded credit blocks cancel';
  exception when invalid_parameter_value then null; end;
  perform public.payment_action(ref, 'cancel', 'Refund not sent');
  perform public.payment_action(adv, 'cancel', 'Entered twice');
  select * into c from public.clients where id = cid;
  assert public.client_credit(c) = 0, 'cancelled receipt leaves no credit';

  -- Proof documents follow payment permissions
  insert into public.documents (organization_id, entity_type, entity_id, path, file_name, mime_type, size_bytes)
  values (public.current_org_id(), 'payment', p1, public.current_org_id() || '/payment/' || p1 || '/upi.png', 'upi.png', 'image/png', 1200);
  insert into storage.objects (bucket_id, name) values ('documents', public.current_org_id() || '/payment/' || p1 || '/upi.png');
  begin
    insert into storage.objects (bucket_id, name) values ('documents', public.current_org_id() || '/expense/x/upi.png');
    assert false, 'only payment folders for now';
  exception when insufficient_privilege then null; end;
end $$;

-- Staff: no access to payments
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'staff@test.local'), 'role', 'authenticated')::text, true);
do $$ begin
  assert (select count(*) from public.payments) = 0, 'staff cannot view payments';
  assert (select count(*) from public.documents) = 0, 'staff cannot view proofs';
  assert (select count(*) from storage.objects where bucket_id = 'documents') = 0, 'staff cannot read proof files';
  begin
    perform public.save_payment(null, jsonb_build_object('client_id', (select id from public.clients where company_name = 'Pay Co'),
      'amount', 1, 'method', 'cash'));
    assert false, 'staff cannot record payments';
  exception when insufficient_privilege then null; end;
end $$;

select 'payment checks passed' as result;
rollback;
