-- Leads are shared (PRD §47, owner decision): no owner; everyone with leads.view sees every lead, and leads.update,
-- leads.convert and leads.delete act on any lead. created_by and lead_activities.created_by still record who did what.

drop policy "leads.view reads own and added, view_all reads all" on public.leads;
drop policy "leads.create adds leads for any lead holder" on public.leads;
drop policy "leads.update edits open leads" on public.leads;
drop policy "leads.delete removes open leads" on public.leads;
drop policy "lead owner logs activities" on public.lead_activities;
drop function public.lead_owners();
alter table public.leads drop column owner_id;
delete from public.permissions where key = 'leads.view_all';   -- role grants cascade

create policy "leads.view reads leads" on public.leads for select to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('leads.view')));
-- Won (and the client link) only through convert_lead.
create policy "leads.create adds leads" on public.leads for insert to authenticated
  with check (organization_id = (select public.current_org_id()) and (select public.has_permission('leads.create'))
              and status <> 'won' and client_id is null);
create policy "leads.update edits open leads" on public.leads for update to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('leads.update')) and status <> 'won')
  with check (organization_id = (select public.current_org_id()) and status <> 'won' and client_id is null);
create policy "leads.delete removes open leads" on public.leads for delete to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('leads.delete')) and status <> 'won');
create policy "leads.update logs activities" on public.lead_activities for insert to authenticated
  with check (organization_id = (select public.current_org_id()) and (select public.has_permission('leads.update'))
              and created_by = (select auth.uid()) and exists (select 1 from public.leads l where l.id = lead_id));

-- Names for "added by" and "logged by": active users who can see leads (profiles are otherwise private to users.view).
create function public.lead_users() returns table (id uuid, full_name text, email text)
language sql stable security definer set search_path = '' as $$
  select distinct p.id, p.full_name, p.email from public.profiles p
  join public.role_permissions rp on rp.role_id = p.role_id
  where p.organization_id = public.current_org_id() and p.is_active and rp.permission = 'leads.view'
    and public.has_permission('leads.view')
  order by p.full_name, p.email;
$$;

create or replace function public.convert_lead(p_id uuid, p_client_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  org uuid := public.current_org_id();
  ld public.leads;
  cid uuid := p_client_id;
begin
  if org is null or not public.has_permission('leads.convert') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select * into ld from public.leads where id = p_id and organization_id = org for update;
  if ld.id is null then
    raise exception 'Lead not found' using errcode = '22023';
  end if;
  if ld.status = 'won' then
    raise exception 'This lead is already won' using errcode = '22023';
  end if;

  if cid is null then
    insert into public.clients (organization_id, company_name)
    values (org, coalesce(nullif(trim(ld.company), ''), ld.name))
    returning id into cid;
    insert into public.client_contacts (organization_id, client_id, name, email, phone, is_primary)
    values (org, cid, ld.name, ld.email, ld.phone, true);
  elsif not exists (select 1 from public.clients where id = cid and organization_id = org and deleted_at is null) then
    raise exception 'Choose an active client' using errcode = '22023';
  end if;

  update public.leads
  set status = 'won', client_id = cid, won_at = now(), lost_reason = null, next_follow_up = null, follow_up_note = ''
  where id = p_id;
  return cid;
end;
$$;

revoke execute on function public.lead_users from public, anon;
grant execute on function public.lead_users to authenticated;
