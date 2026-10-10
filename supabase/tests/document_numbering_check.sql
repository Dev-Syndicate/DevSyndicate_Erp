-- Self-check for custom document numbering. Runs inside a transaction and rolls back.
begin;

do $$ begin
  assert public.render_document_number('INV/{FY}/{SEQ}', 4, 7, '2026-10-10') = 'INV/26-27/0007', 'FY pattern';
  assert public.render_document_number('INV/{FY}/{SEQ}', 4, 7, '2027-03-31') = 'INV/26-27/0007', 'March is previous FY';
  assert public.render_document_number('DS{YYYY}{MM}-{SEQ}', 3, 12345, '2026-04-01') = 'DS202604-12345', 'counter grows past padding';
  assert public.render_document_number('Q{YY}-{SEQ}', 1, 5, '2026-01-15') = 'Q26-5', 'YY and padding 1';
  assert public.document_period_key('financial_year', '2026-04-01') = '2026-27', 'FY key';
  assert public.document_period_key('financial_year', '2026-03-31') = '2025-26', 'FY key before April';
  assert public.document_period_key('calendar_year', '2026-12-31') = '2026', 'CY key';
  assert public.document_period_key('never', '2026-12-31') = 'all', 'never resets';
end $$;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
select gen_random_uuid(), r.key || '@test.local', jsonb_build_object('role_id', r.id), '{}', 'authenticated', 'authenticated'
from public.roles r where r.key in ('super_admin', 'staff');
create temp table u as select email, id from public.profiles where email like '%@test.local';
grant select on u to authenticated;
set local role authenticated;

-- Staff cannot change numbering
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'staff@test.local'), 'role', 'authenticated')::text, true);
do $$ begin
  begin
    perform public.set_document_numbering('invoice', 'X/{FY}/{SEQ}', 4, 'financial_year', 1);
    assert false, 'staff cannot change numbering';
  exception when insufficient_privilege then null; end;
  assert (select count(*) from public.document_numbering_settings()) = 5, 'members can read numbering';
end $$;

-- Super Admin: custom format, starting number, rule enforcement
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'super_admin@test.local'), 'role', 'authenticated')::text, true);
do $$ begin
  perform public.set_document_numbering('invoice', 'DS-{FY}-{SEQ}', 3, 'financial_year', 46);
  assert (select next_value from public.document_numbering_settings() where doc_type = 'invoice') = 46, 'next number set';
  begin
    perform public.set_document_numbering('invoice', 'DS-INVOICE-{FY}-{SEQ}', 4, 'financial_year', 1);
    assert false, 'invoice numbers max 16 chars';
  exception when check_violation then null; end;
  begin
    perform public.set_document_numbering('quotation', 'Q-{SEQ}', 4, 'financial_year', 1);
    assert false, 'yearly reset needs the year';
  exception when check_violation then null; end;
  begin
    perform public.set_document_numbering('quotation', 'Q-{YYYY}', 4, 'never', 1);
    assert false, 'pattern needs {SEQ}';
  exception when check_violation then null; end;
  perform public.set_document_numbering('expense', 'EXP-{SEQ}', 5, 'never', 1);
end $$;

-- Issuing (as the issuing functions will, i.e. with definer rights)
reset role;
do $$ begin
  assert public.next_document_number('invoice', public.ist_today()) like 'DS-__-__-046', 'continues from 46';
  assert public.next_document_number('invoice', public.ist_today()) like 'DS-__-__-047', 'gapless +1';
  assert public.next_document_number('expense', public.ist_today()) = 'EXP-00001', 'never-reset counter';
  assert public.next_document_number('invoice', '2099-04-01') = 'DS-99-00-001', 'new financial year restarts at 1';
end $$;

select 'document numbering checks passed' as result;
rollback;

-- Monthly reset (migration 20261010143858)
begin;
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
select gen_random_uuid(), 'sa@test.local', jsonb_build_object('role_id', id), '{}', 'authenticated', 'authenticated' from public.roles where key = 'super_admin';
select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'sa@test.local'), 'role', 'authenticated')::text, true);
do $$ begin
  assert public.document_period_key('monthly', '2026-10-10') = '2026-10', 'monthly key';
  perform public.set_document_numbering('quotation', 'Q{YY}{MM}-{SEQ}', 3, 'monthly', 1);
  assert public.next_document_number('quotation', '2026-10-10') = 'Q2610-001', 'monthly first';
  assert public.next_document_number('quotation', '2026-10-31') = 'Q2610-002', 'same month continues';
  assert public.next_document_number('quotation', '2026-11-01') = 'Q2611-001', 'new month restarts';
  begin
    perform public.set_document_numbering('quotation', 'Q{YYYY}-{SEQ}', 3, 'monthly', 1);
    assert false, 'monthly needs {MM}';
  exception when check_violation then null; end;
end $$;
select 'monthly checks passed' as result;
rollback;
