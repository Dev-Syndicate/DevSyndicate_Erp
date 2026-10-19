-- Self-check for CRM leads (PRD §47, v1.6): shared leads (one adds, another calls and updates), activities with who
-- logged them, duplicates, Lost needs a reason, Won only through convert_lead (new or existing client), won leads
-- locked, permissions. Rolls back.
begin;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
select gen_random_uuid(), r.key || x || '@test.local', jsonb_build_object('role_id', r.id), '{}', 'authenticated', 'authenticated'
from public.roles r, (values (''), ('2')) v(x) where r.key in ('admin', 'finance') and x = '' or r.key = 'staff';
create temp table u as select email, id from public.profiles where email like '%@test.local';
grant select on u to authenticated;

create function pg_temp.act_as(e text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = e), 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- Staff adds a lead; validation
select pg_temp.act_as('staff@test.local');
do $$ begin
  insert into public.leads (organization_id, name, company, phone, source)
  values (public.current_org_id(), 'Asha Rao', 'Rao Studio', '+91 98450 12345', 'instagram');
  assert (select created_by from public.leads where name = 'Asha Rao') = (select id from u where email = 'staff@test.local'), 'added by is recorded';
  begin
    update public.leads set status = 'won' where name = 'Asha Rao';
    assert false, 'won only through convert_lead';
  exception when insufficient_privilege then null; end;
  begin
    update public.leads set status = 'lost' where name = 'Asha Rao';
    assert false, 'lost needs a reason';
  exception when check_violation then null; end;
  begin
    insert into public.leads (organization_id, name, source) values (public.current_org_id(), 'No contact', 'other');
    assert false, 'email or phone required';
  exception when check_violation then null; end;
  delete from public.leads where name = 'Asha Rao';
  assert exists (select 1 from public.leads where name = 'Asha Rao'), 'staff cannot delete';
end $$;

-- Another staff member sees it, calls, updates it and logs the call
select pg_temp.act_as('staff2@test.local');
do $$
declare lid uuid := (select id from public.leads where name = 'Asha Rao');
begin
  assert lid is not null, 'leads are shared';
  insert into public.lead_activities (organization_id, lead_id, kind, body) values (public.current_org_id(), lid, 'call', 'Intro call');
  update public.leads set status = 'contacted', next_follow_up = public.ist_today(), follow_up_note = 'Send proposal' where id = lid;
  assert (select status from public.leads where id = lid) = 'contacted', 'any lead user updates it';
  assert (select created_by from public.lead_activities where lead_id = lid) = (select id from u where email = 'staff2@test.local'), 'logged by is recorded';
  begin
    insert into public.lead_activities (organization_id, lead_id, kind, body, created_by)
    values (public.current_org_id(), lid, 'note', 'Forged', (select id from u where email = 'staff@test.local'));
    assert false, 'cannot log as someone else';
  exception when insufficient_privilege then null; end;
  assert (select count(*) from public.lead_users() where email like 'staff%@test.local') = 2, 'names for added by / logged by';
  -- Duplicate by phone, ignoring spaces and +91
  assert exists (select 1 from public.lead_duplicates('', '09845012345')), 'phone duplicate found';
  assert not exists (select 1 from public.lead_duplicates('', '09845012345', lid)), 'the lead itself is excluded';
end $$;

-- Finance has no leads access
select pg_temp.act_as('finance@test.local');
do $$ begin
  assert not exists (select 1 from public.leads), 'finance cannot see leads';
  assert not exists (select 1 from public.lead_users()), 'nor lead user names';
  begin
    perform public.convert_lead((select id from u limit 1));
    assert false, 'finance cannot convert';
  exception when insufficient_privilege then null; end;
end $$;

-- Staff converts: a new client with the person as primary contact; the lead is then locked
select pg_temp.act_as('staff@test.local');
do $$
declare
  lid uuid := (select id from public.leads where name = 'Asha Rao');
  cid uuid;
begin
  cid := public.convert_lead(lid);
  assert (select company_name from public.clients where id = cid) = 'Rao Studio', 'client from the company';
  assert (select name from public.client_contacts where client_id = cid and is_primary) = 'Asha Rao', 'primary contact from the lead';
  assert (select status = 'won' and client_id = cid and next_follow_up is null from public.leads where id = lid), 'lead won and linked';
  update public.leads set notes = 'changed' where id = lid;
  assert (select notes from public.leads where id = lid) = '', 'won leads are read-only';
  begin
    perform public.convert_lead(lid);
    assert false, 'cannot convert twice';
  exception when invalid_parameter_value then null; end;

  -- Linking to an existing client creates nothing new
  insert into public.leads (organization_id, name, email, source, status, lost_reason)
  values (public.current_org_id(), 'Second Contact', 'second@test.local', 'referral', 'lost', 'Budget');
  assert public.convert_lead((select id from public.leads where name = 'Second Contact'), cid) = cid, 'linked to the existing client';
  assert (select count(*) from public.client_contacts where client_id = cid) = 1, 'no extra contact when linking';
end $$;

-- Admin cannot delete won leads; deletes open ones
select pg_temp.act_as('admin@test.local');
do $$ begin
  delete from public.leads where name = 'Asha Rao';
  assert exists (select 1 from public.leads where name = 'Asha Rao'), 'won leads cannot be deleted';
  insert into public.leads (organization_id, name, email, source) values (public.current_org_id(), 'Mistake', 'm@test.local', 'other');
  delete from public.leads where name = 'Mistake';
  assert not exists (select 1 from public.leads where name = 'Mistake'), 'open lead deleted';
end $$;

select 'leads checks passed' as result;
rollback;
