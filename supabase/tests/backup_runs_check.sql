-- Self-check for backup_runs (PRD §34): settings.view reads the backup status, staff cannot. Rolls back.
begin;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
select gen_random_uuid(), r.key || '@test.local', jsonb_build_object('role_id', r.id), '{}', 'authenticated', 'authenticated'
from public.roles r where r.key in ('finance', 'staff');
create temp table u as select email, id from public.profiles where email like '%@test.local';
grant select on u to authenticated;

-- As the backup job does (database owner, no JWT)
insert into public.backup_runs (organization_id, status, size_bytes, files)
select id, 'success', 417591, 3 from public.organizations;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'finance@test.local'), 'role', 'authenticated')::text, true);
do $$ begin
  assert exists (select 1 from public.backup_runs where size_bytes = 417591), 'finance sees the backup status';
  begin
    insert into public.backup_runs (organization_id, status) values (public.current_org_id(), 'success');
    assert false, 'users cannot write backup runs';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'staff@test.local'), 'role', 'authenticated')::text, true);
do $$ begin
  assert not exists (select 1 from public.backup_runs), 'staff cannot see backups';
end $$;

select 'backup run checks passed' as result;
rollback;
