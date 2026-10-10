-- Self-check for the branding bucket policies. Runs inside a transaction and rolls back.
begin;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
select gen_random_uuid(), r.key || '@test.local', jsonb_build_object('role_id', r.id), '{}', 'authenticated', 'authenticated'
from public.roles r where r.key in ('super_admin', 'staff');
create temp table u as select email, id from public.profiles where email like '%@test.local';
grant select on u to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'super_admin@test.local'), 'role', 'authenticated')::text, true);
do $$ begin
  insert into storage.objects (bucket_id, name) values ('branding', public.current_org_id() || '/logo-test.png');
  begin
    insert into storage.objects (bucket_id, name) values ('branding', gen_random_uuid() || '/logo-test.png');
    assert false, 'other organization folder is blocked';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = 'staff@test.local'), 'role', 'authenticated')::text, true);
do $$ begin
  assert (select count(*) from storage.objects where bucket_id = 'branding' and name like '%/logo-test.png') = 1, 'members can read branding';
  begin
    insert into storage.objects (bucket_id, name) values ('branding', public.current_org_id() || '/signature-test.png');
    assert false, 'staff cannot upload branding';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
do $$ begin
  assert (select not public and allowed_mime_types = array['image/png', 'image/jpeg'] from storage.buckets where id = 'branding'),
    'branding bucket is private, PNG/JPEG only';
end $$;

select 'branding checks passed' as result;
rollback;
