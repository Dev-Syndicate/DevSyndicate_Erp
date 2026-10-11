-- Self-check for users & roles (PRD §4–§6, §32.4): invite checks and activation, role changes, Super Admin
-- protections, custom roles, the locked Super Admin role, permissions. Rolls back.
begin;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
select gen_random_uuid(), r.key || '@test.local', jsonb_build_object('role_id', r.id), '{}', 'authenticated', 'authenticated'
from public.roles r where r.key in ('super_admin', 'admin', 'finance', 'staff');
-- An invitee as generateLink creates it: no role yet, so the profile is inactive.
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
values (gen_random_uuid(), 'invitee@test.local', '{}', '{}', 'authenticated', 'authenticated');
create temp table u as select email, id from public.profiles where email like '%@test.local';
grant select on u to authenticated;

set local role authenticated;

-- Admin
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'admin@test.local'), 'role', 'authenticated')::text, true);
do $$
declare
  finance_role uuid := (select id from public.roles where key = 'finance');
  staff_role uuid := (select id from public.roles where key = 'staff');
  sa_role uuid := (select id from public.roles where key = 'super_admin');
  invitee uuid := (select id from u where email = 'invitee@test.local');
begin
  assert not exists (select 1 from public.list_users() where role_key = 'super_admin'), 'admins do not see Super Admins';
  assert exists (select 1 from public.list_users() where email = 'finance@test.local'), 'admins see other users';

  perform public.check_invite('new.person@test.local', finance_role);
  begin
    perform public.check_invite('boss@test.local', sa_role);
    assert false, 'only a Super Admin invites a Super Admin';
  exception when insufficient_privilege then null; end;
  begin
    perform public.check_invite('FINANCE@test.local', finance_role);
    assert false, 'existing email refused';
  exception when invalid_parameter_value then null; end;

  perform public.activate_invited_user(invitee, finance_role, 'New Person');
  assert (select is_active and role_id = finance_role and full_name = 'New Person' from public.profiles where id = invitee), 'invitee activated';
  begin
    perform public.activate_invited_user(invitee, staff_role, 'Again');
    assert false, 'an existing user cannot be re-activated as an invite';
  exception when invalid_parameter_value then null; end;

  perform public.update_user((select id from u where email = 'finance@test.local'), staff_role, true);
  assert (select role_id = staff_role from public.profiles where email = 'finance@test.local'), 'role changed';
  perform public.update_user((select id from u where email = 'finance@test.local'), staff_role, false);
  assert (select not is_active from public.profiles where email = 'finance@test.local'), 'deactivated';
  begin
    perform public.update_user((select id from u where email = 'admin@test.local'), finance_role, true);
    assert false, 'no changes to yourself';
  exception when raise_exception then null; end;
  begin
    perform public.update_user((select id from u where email = 'super_admin@test.local'), finance_role, true);
    assert false, 'admins cannot change a Super Admin';
  exception when raise_exception then null; end;
  begin
    perform public.create_role('Sales');
    assert false, 'admins cannot create roles';
  exception when insufficient_privilege then null; end;
end $$;

-- Super Admin
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'super_admin@test.local'), 'role', 'authenticated')::text, true);
do $$
declare
  rid uuid;
  sa_role uuid := (select id from public.roles where key = 'super_admin');
begin
  assert exists (select 1 from public.list_users() where role_key = 'super_admin'), 'Super Admins see Super Admins';
  rid := public.create_role('Sales Team');
  assert (select key = 'sales_team' and not is_system from public.roles where id = rid), 'custom role';
  insert into public.role_permissions (role_id, permission) values (rid, 'clients.view');
  begin
    perform public.create_role('sales team');
    assert false, 'duplicate role name';
  exception when invalid_parameter_value then null; end;
  begin
    delete from public.role_permissions where role_id = sa_role and permission = 'invoices.view';
    assert false, 'Super Admin permissions are locked';
  exception when insufficient_privilege then null; end;
end $$;

-- Staff: nothing
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'staff@test.local'), 'role', 'authenticated')::text, true);
do $$ begin
  assert not exists (select 1 from public.list_users()), 'staff cannot list users';
  begin
    perform public.check_invite('x@test.local', (select id from public.roles where key = 'staff'));
    assert false, 'staff cannot invite';
  exception when insufficient_privilege then null; end;
end $$;

select 'users and roles checks passed' as result;
rollback;
