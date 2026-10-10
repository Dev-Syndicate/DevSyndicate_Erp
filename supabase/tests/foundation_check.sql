-- Self-check for the foundation migration. Runs inside a transaction and rolls back.
-- Run in the Supabase SQL editor (or psql). Any failed assert aborts with a message.
begin;

-- Fixtures: one user per system role, plus a public sign-up with no role.
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
select gen_random_uuid(), r.key || '@test.local', jsonb_build_object('role_id', r.id), '{}', 'authenticated', 'authenticated'
from public.roles r;
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
values (gen_random_uuid(), 'stranger@test.local', '{}', '{}', 'authenticated', 'authenticated');

create temp table u as select p.email, p.id from public.profiles p where p.email like '%@test.local';
grant select on u to authenticated;

do $$ begin
  assert (select is_active from public.profiles where email = 'finance@test.local'), 'invited user should be active';
  assert not (select is_active from public.profiles where email = 'stranger@test.local'), 'sign-up without role must be inactive';
  assert (select count(*) from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.key = 'staff') = 4, 'staff has 4 permissions';
end $$;

-- As Staff
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'staff@test.local'), 'role', 'authenticated')::text, true);
do $$ begin
  assert public.has_permission('clients.view'), 'staff can view clients';
  assert not public.has_permission('payments.view'), 'staff cannot view payments';
  assert (select count(*) from public.profiles) = 1, 'staff sees only own profile';
  assert (select count(*) from public.roles) = 1, 'staff sees only own role';
  assert (select count(*) from public.audit_logs) = 0, 'staff cannot read audit logs';
end $$;

-- As stranger (public sign-up)
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'stranger@test.local'), 'role', 'authenticated')::text, true);
do $$ begin
  assert not public.has_permission('dashboard.view'), 'stranger has no permissions';
  assert (select count(*) from public.organizations) = 0, 'stranger sees no organization';
end $$;

-- As Admin: cannot touch the Super Admin, can manage others
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'admin@test.local'), 'role', 'authenticated')::text, true);
do $$ begin
  begin
    update public.profiles set is_active = false where email = 'super_admin@test.local';
    assert false, 'admin must not deactivate super admin';
  exception when raise_exception then null; end;
  update public.profiles set full_name = 'Fin' where email = 'finance@test.local';
  assert found, 'admin can update a finance user';
  begin
    update public.profiles set role_id = (select id from public.roles where key = 'staff') where email = 'admin@test.local';
    assert false, 'user must not change own role';
  exception when raise_exception then null; end;
end $$;

-- As Super Admin: last active super admin cannot be removed
reset role;
update public.profiles set is_active = false
where role_id = (select id from public.roles where key = 'super_admin') and email not like '%@test.local';
do $$ begin
  begin
    update public.profiles set is_active = false where email = 'super_admin@test.local';
    assert false, 'last super admin must remain';
  exception when raise_exception then null; end;
  begin
    delete from public.roles where key = 'finance';
    assert false, 'system roles cannot be deleted';
  exception when raise_exception then null; end;
  assert (select count(*) from public.audit_logs where action = 'profiles.update') > 0, 'profile updates are audited';
end $$;

select 'foundation checks passed' as result;
rollback;
