-- Self-check for credit notes (PRD §18, v1.3): tax reversal at the invoice's supply, balance, total cap,
-- overpayment released to client credit, cancel rules, GST time limit, permissions. Rolls back.
begin;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
select gen_random_uuid(), r.key || '@test.local', jsonb_build_object('role_id', r.id), '{}', 'authenticated', 'authenticated'
from public.roles r where r.key in ('super_admin', 'staff');
create temp table u as select email, id from public.profiles where email like '%@test.local';
grant select on u to authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'super_admin@test.local'), 'role', 'authenticated')::text, true);

update public.company_settings set state = 'Tamil Nadu', gst_registered = true, gstin = '33ABCDE1234F1Z5', round_off = true;
insert into public.clients (organization_id, company_name, state, country)
values (public.current_org_id(), 'CN Co', 'Tamil Nadu', 'India');

set local role authenticated;
do $$
declare
  cid uuid := (select id from public.clients where company_name = 'CN Co');
  inv1 uuid; inv2 uuid; old uuid; cn1 uuid; cn2 uuid; pay uuid; i public.invoices; c public.clients; n public.credit_notes;
  line jsonb := '[{"description": "Price correction", "quantity": 1, "unit_price": 1000, "tax_rate": 18}]';
begin
  inv1 := public.save_invoice(null, jsonb_build_object('client_id', cid, 'due_date', public.ist_today() + 15,
            'items', '[{"description": "Website", "quantity": 1, "unit_price": 10000, "tax_rate": 18}]'::jsonb));
  perform public.invoice_action(inv1, 'issue');

  -- Draft: tax reverses at the invoice's supply type
  cn1 := public.save_credit_note(null, jsonb_build_object('invoice_id', inv1, 'reason', 'Discount agreed after delivery', 'items', line));
  select * into n from public.credit_notes where id = cn1;
  assert n.status = 'draft' and n.number is null and n.supply_type = 'intra', 'draft follows the invoice supply';
  assert n.cgst_total = 90 and n.sgst_total = 90 and n.grand_total = 1180, 'CGST/SGST reversed';
  select * into i from public.invoices where id = inv1;
  assert public.balance_due(i) = 11800, 'drafts do not change the balance';

  -- Issue: number, recipient from the invoice, lower balance
  perform public.credit_note_action(cn1, 'issue');
  select * into n from public.credit_notes where id = cn1;
  select * into i from public.invoices where id = inv1;
  assert n.status = 'issued' and n.number is not null and n.billing_name = 'CN Co', 'issue assigns number and recipient';
  assert public.amount_credited(i) = 1180 and public.balance_due(i) = 10620, 'credit note reduces the balance';

  -- Cannot credit more than the invoice total
  cn2 := public.save_credit_note(null, jsonb_build_object('invoice_id', inv1, 'reason', 'Too much',
           'items', '[{"description": "X", "quantity": 1, "unit_price": 10000, "tax_rate": 18}]'::jsonb));
  begin
    perform public.credit_note_action(cn2, 'issue');
    assert false, 'credit notes capped at the invoice total';
  exception when invalid_parameter_value then null; end;

  -- Invoice with a credit note cannot be cancelled; cancelling the note restores the balance
  begin
    perform public.invoice_action(inv1, 'cancel');
    assert false, 'invoice with credit notes cannot be cancelled';
  exception when invalid_parameter_value then null; end;
  perform public.credit_note_action(cn1, 'cancel');
  select * into i from public.invoices where id = inv1;
  assert public.balance_due(i) = 11800, 'cancelled credit note no longer counts';

  -- Paid invoice: the overpaid part goes back to client credit
  inv2 := public.save_invoice(null, jsonb_build_object('client_id', cid, 'due_date', public.ist_today() + 15,
            'items', '[{"description": "Hosting", "quantity": 1, "unit_price": 1000, "tax_rate": 18}]'::jsonb));
  perform public.invoice_action(inv2, 'issue');
  pay := public.save_payment(null, jsonb_build_object('client_id', cid, 'amount', 1180, 'method', 'upi',
           'allocations', jsonb_build_array(jsonb_build_object('invoice_id', inv2, 'amount', 1180))));
  perform public.payment_action(pay, 'confirm');
  perform public.credit_note_action(public.save_credit_note(null, jsonb_build_object('invoice_id', inv2, 'reason', 'Half refund',
    'items', '[{"description": "Hosting refund", "quantity": 1, "unit_price": 500, "tax_rate": 18}]'::jsonb)), 'issue');
  select * into i from public.invoices where id = inv2;
  select * into c from public.clients where id = cid;
  assert public.balance_due(i) = 0 and public.amount_paid(i) = 590, 'invoice stays settled';
  assert public.client_credit(c) = 590, 'overpaid part becomes client credit';

  -- GST: credit notes for FY 2024-25 invoices were due by 30-11-2025
  old := public.save_invoice(null, jsonb_build_object('client_id', cid, 'invoice_date', '2024-05-01', 'due_date', '2024-05-15',
           'items', '[{"description": "Old work", "quantity": 1, "unit_price": 1000, "tax_rate": 18}]'::jsonb));
  perform public.invoice_action(old, 'issue');
  begin
    perform public.credit_note_action(public.save_credit_note(null, jsonb_build_object('invoice_id', old, 'reason', 'Late',
      'items', line)), 'issue');
    assert false, 'GST time limit enforced';
  exception when invalid_parameter_value then null; end;
end $$;

-- Staff: no access to credit notes
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'staff@test.local'), 'role', 'authenticated')::text, true);
do $$ begin
  assert (select count(*) from public.credit_notes) = 0, 'staff cannot view credit notes';
  begin
    perform public.save_credit_note(null, jsonb_build_object('invoice_id', gen_random_uuid(), 'reason', 'x',
      'items', '[{"description": "X", "quantity": 1, "unit_price": 1}]'::jsonb));
    assert false, 'staff cannot create credit notes';
  exception when insufficient_privilege then null; end;
end $$;

select 'credit note checks passed' as result;
rollback;
