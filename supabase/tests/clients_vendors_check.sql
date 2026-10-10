-- Self-check for clients/contacts/vendors. Runs inside a transaction and rolls back.
begin;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
select gen_random_uuid(), r.key || '@test.local', jsonb_build_object('role_id', r.id), '{}', 'authenticated', 'authenticated'
from public.roles r where r.key in ('finance', 'staff');
create temp table u as select email, id from public.profiles where email like '%@test.local';
grant select on u to authenticated;

set local role authenticated;

-- Finance: full client and vendor management
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'finance@test.local'), 'role', 'authenticated')::text, true);
do $$
declare c uuid;
begin
  insert into public.clients (organization_id, company_name, state, gstin)
  values (public.current_org_id(), 'SIPLINK', 'Tamil Nadu', '33ABCDE1234F1Z5') returning id into c;
  insert into public.client_contacts (organization_id, client_id, name, is_primary) values (public.current_org_id(), c, 'Ravi', true);
  insert into public.client_contacts (organization_id, client_id, name, is_primary) values (public.current_org_id(), c, 'Second', true);
  assert (select array_agg(name) from public.client_contacts where client_id = c and is_primary) = array['Second'], 'a new primary contact replaces the old one';
  begin
    insert into public.clients (organization_id, company_name, pin_code) values (public.current_org_id(), 'Bad PIN', '12');
    assert false, 'Indian PIN codes are validated';
  exception when check_violation then null; end;
  update public.clients set deleted_at = now() where id = c;
  assert found, 'finance can archive a client';
  insert into public.vendors (organization_id, name) values (public.current_org_id(), 'AWS');
  delete from public.clients where id = c;
  assert not found, 'clients are never hard-deleted';
end $$;

-- Staff: read clients only, no vendors
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'staff@test.local'), 'role', 'authenticated')::text, true);
do $$ begin
  assert (select count(*) from public.clients where company_name = 'SIPLINK') = 1, 'staff can view clients';
  assert (select count(*) from public.client_contacts) = 2, 'staff can view contacts';
  assert (select count(*) from public.vendors) = 0, 'staff cannot view vendors';
  update public.clients set notes = 'x';
  assert not found, 'staff cannot edit clients';
  begin
    insert into public.clients (organization_id, company_name) values (public.current_org_id(), 'Nope');
    assert false, 'staff cannot create clients';
  exception when insufficient_privilege then null; end;
end $$;

-- A role with only clients.delete can archive but not edit other fields
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.roles (organization_id, key, name)
select organization_id, 'archiver', 'Archiver' from public.roles where key = 'staff';
insert into public.role_permissions (role_id, permission)
select id, unnest(array['clients.view', 'clients.delete']) from public.roles where key = 'archiver';
update public.profiles set role_id = (select id from public.roles where key = 'archiver') where email = 'staff@test.local';
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'staff@test.local'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  update public.clients set deleted_at = null where company_name = 'SIPLINK';
  assert found, 'clients.delete can restore';
  begin
    update public.clients set company_name = 'Renamed' where company_name = 'SIPLINK';
    assert false, 'clients.delete alone cannot edit fields';
  exception when raise_exception then null; end;
end $$;

select 'clients/vendors checks passed' as result;
rollback;
