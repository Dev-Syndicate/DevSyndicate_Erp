-- Self-check for the settings migration. Runs inside a transaction and rolls back.
begin;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
select gen_random_uuid(), r.key || '@test.local', jsonb_build_object('role_id', r.id), '{}', 'authenticated', 'authenticated'
from public.roles r where r.key in ('super_admin', 'staff');
create temp table u as select email, id from public.profiles where email like '%@test.local';
grant select on u to authenticated;

set local role authenticated;

-- Staff: can read settings data (needed for quotations), cannot change it
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'staff@test.local'), 'role', 'authenticated')::text, true);
do $$ begin
  assert (select count(*) from public.company_settings) = 1, 'staff reads company settings';
  assert (select count(*) from public.tax_rates) = 3, 'staff reads tax rates';
  assert (select count(*) from public.expense_categories) = 11, 'staff reads expense categories';
  update public.company_settings set legal_name = 'Hacked';
  assert not found, 'staff cannot edit company settings';
  begin
    insert into public.tax_rates (organization_id, name, rate) values (public.current_org_id(), 'X', 1);
    assert false, 'staff cannot add tax rates';
  exception when insufficient_privilege then null; end;
end $$;

-- Super Admin: can edit; constraints hold
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'super_admin@test.local'), 'role', 'authenticated')::text, true);
do $$ begin
  update public.company_settings set legal_name = 'DevSyndicate Pvt Ltd';
  assert found, 'super admin edits company settings';
  begin
    update public.company_settings set gst_registered = true, gstin = '';
    assert false, 'GST registration requires a GSTIN';
  exception when check_violation then null; end;
  begin
    update public.company_settings set gstin = 'BAD';
    assert false, 'GSTIN format is validated';
  exception when check_violation then null; end;
  insert into public.tax_rates (organization_id, name, rate) values (public.current_org_id(), 'GST 40%', 40);
  update public.expense_categories set is_active = false where name = 'Travel';
  assert found, 'super admin archives a category';
  delete from public.expense_categories where name = 'Other';
  assert not found, 'categories cannot be deleted, only archived';
end $$;

reset role;
do $$ begin
  assert (select count(*) from public.audit_logs where action = 'company_settings.update' and record_id is not null) > 0,
    'settings changes are audited with a record id';
end $$;

select 'settings checks passed' as result;
rollback;
