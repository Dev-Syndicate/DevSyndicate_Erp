-- Self-check for notifications (PRD §50, v1.7): a website enquiry notifies each active user with leads.view (not
-- finance), each person sees and marks only their own, only read_at can change, users can't create them. Rolls back.
begin;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
select gen_random_uuid(), r.key || '@test.local', jsonb_build_object('role_id', r.id), '{}', 'authenticated', 'authenticated'
from public.roles r where r.key in ('admin', 'finance', 'staff');
create temp table u as select email, id from public.profiles where email like '%@test.local';
grant select on u to authenticated;
update public.company_settings set website_form_key_hash = encode(sha256(convert_to('test-form-key', 'UTF8')), 'hex');

create function pg_temp.act_as(e text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = e), 'role', 'authenticated')::text, true);
$$;

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select public.submit_website_lead('test-form-key', 'Jane Okafor', 'jane@test.local', 'Okafor Labs', 'AI Systems', 'Hi');

reset role;
do $$ begin
  assert (select count(*) from public.notifications n join u on u.id = n.user_id where u.email in ('admin@test.local', 'staff@test.local')) = 2,
    'everyone with leads.view is notified';
  assert not exists (select 1 from public.notifications n join u on u.id = n.user_id where u.email = 'finance@test.local'), 'finance is not';
  assert (select title = 'New website enquiry from Jane Okafor' and body = 'Okafor Labs · AI Systems' and link like '/leads/%' and read_at is null
          from public.notifications n join u on u.id = n.user_id where u.email = 'staff@test.local'), 'title, body, link, unread';
end $$;

set local role authenticated;
select pg_temp.act_as('staff@test.local');
do $$ begin
  assert (select count(*) from public.notifications) = 1, 'staff sees only their own';
  update public.notifications set read_at = now();
  assert (select read_at is not null from public.notifications), 'staff marks theirs read';
  begin
    update public.notifications set title = 'Changed';
    assert false, 'only read_at can change';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.notifications (organization_id, user_id, kind, title) values (public.current_org_id(), auth.uid(), 'website_enquiry', 'Fake');
    assert false, 'users cannot create notifications';
  exception when insufficient_privilege then null; end;
  begin
    perform public.notify(public.current_org_id(), 'leads.view', 'website_enquiry', 'Fake', '', '');
    assert false, 'notify is internal';
  exception when insufficient_privilege then null; end;
end $$;

select pg_temp.act_as('admin@test.local');
do $$ begin
  assert (select read_at is null from public.notifications), 'reading is per person: admin still unread';
end $$;

select 'notifications checks passed' as result;
rollback;
