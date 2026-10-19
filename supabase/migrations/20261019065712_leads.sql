-- CRM leads (PRD §47, v1.6): possible clients before any quotation, an activity log and a next follow-up.
-- leads.view sees the leads you own; leads.view_all sees every lead and may change owners (Zoho's private default).
-- Won goes through convert_lead, which creates or links the client.

-- ───────────────────────── Permissions ─────────────────────────
insert into public.permissions (key) values
  ('leads.view'), ('leads.view_all'), ('leads.create'), ('leads.update'), ('leads.delete'), ('leads.convert');

insert into public.role_permissions (role_id, permission)
select r.id, p.key from public.roles r join public.permissions p on p.key like 'leads.%'
where r.key in ('super_admin', 'admin')
   or (r.key = 'staff' and p.key in ('leads.view', 'leads.create', 'leads.update', 'leads.convert'));

-- ───────────────────────── Tables ─────────────────────────
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null check (length(trim(name)) between 1 and 200),
  company text not null default '' check (length(company) <= 200),
  email text not null default '' check (length(email) <= 320),
  phone text not null default '' check (length(phone) <= 30),
  source text not null check (source in ('referral', 'linkedin', 'instagram', 'website', 'cold_outreach', 'other')),
  source_detail text not null default '' check (length(source_detail) <= 500),
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'lost', 'won')),
  lost_reason text check (length(lost_reason) <= 500),
  owner_id uuid not null default auth.uid() references public.profiles(id),
  next_follow_up date,
  follow_up_note text not null default '' check (length(follow_up_note) <= 500),
  notes text not null default '' check (length(notes) <= 5000),
  client_id uuid references public.clients(id),
  won_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email <> '' or phone <> ''),
  check (status <> 'lost' or length(trim(coalesce(lost_reason, ''))) > 0),
  check ((status = 'won') = (client_id is not null))
);

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  lead_id uuid not null references public.leads(id) on delete cascade,
  kind text not null check (kind in ('call', 'meeting', 'email', 'message', 'note')),
  body text not null check (length(trim(body)) between 1 and 5000),
  happened_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

create index on public.leads (organization_id, status, next_follow_up);
create index on public.leads (owner_id);
create index on public.leads (client_id);
create index on public.lead_activities (lead_id, happened_at desc);
create index on public.lead_activities (organization_id);
create index on public.lead_activities (created_by);

create trigger set_updated_at before update on public.leads for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.leads for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.lead_activities for each row execute function public.audit_row_change();

-- ───────────────────────── RLS ─────────────────────────
alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;

create policy "leads.view reads own, view_all reads all" on public.leads for select to authenticated
  using (organization_id = (select public.current_org_id())
         and ((select public.has_permission('leads.view_all'))
              or ((select public.has_permission('leads.view')) and owner_id = (select auth.uid()))));
-- Won (and the client link) only through convert_lead; only view_all may give a lead to someone else.
create policy "leads.create adds leads" on public.leads for insert to authenticated
  with check (organization_id = (select public.current_org_id()) and (select public.has_permission('leads.create'))
              and status <> 'won' and client_id is null
              and (owner_id = (select auth.uid()) or (select public.has_permission('leads.view_all'))));
create policy "leads.update edits open leads" on public.leads for update to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('leads.update')) and status <> 'won'
         and ((select public.has_permission('leads.view_all')) or owner_id = (select auth.uid())))
  with check (organization_id = (select public.current_org_id()) and status <> 'won' and client_id is null
              and ((select public.has_permission('leads.view_all')) or owner_id = (select auth.uid())));
create policy "leads.delete removes open leads" on public.leads for delete to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('leads.delete')) and status <> 'won'
         and ((select public.has_permission('leads.view_all')) or owner_id = (select auth.uid())));

-- Activities follow their lead: whoever can see the lead sees them; leads.update logs them. Append-only.
create policy "lead activities readable" on public.lead_activities for select to authenticated
  using (organization_id = (select public.current_org_id()) and exists (select 1 from public.leads l where l.id = lead_id));
create policy "leads.update logs activities" on public.lead_activities for insert to authenticated
  with check (organization_id = (select public.current_org_id()) and (select public.has_permission('leads.update'))
              and created_by = (select auth.uid()) and exists (select 1 from public.leads l where l.id = lead_id));

revoke all on public.leads, public.lead_activities from anon;

-- ───────────────────────── Owners ─────────────────────────
-- Active users who can hold leads, for the owner picker (view_all only) and owner names.
create function public.lead_owners() returns table (id uuid, full_name text, email text)
language sql stable security definer set search_path = '' as $$
  select distinct p.id, p.full_name, p.email from public.profiles p
  join public.role_permissions rp on rp.role_id = p.role_id
  where p.organization_id = public.current_org_id() and p.is_active and rp.permission = 'leads.view'
    and (public.has_permission('leads.view') or public.has_permission('leads.view_all'))
  order by p.full_name, p.email;
$$;

-- ───────────────────────── Duplicates ─────────────────────────
-- Other leads and client contacts with the same email or phone (last 10 digits), across owners (PRD §47: warn only).
create function public.lead_duplicates(p_email text, p_phone text, p_exclude uuid default null)
returns table (kind text, name text, detail text)
language sql stable security definer set search_path = '' as $$
  with k as (
    select nullif(lower(trim(p_email)), '') as email,
           nullif(right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10), '') as phone
  )
  select 'lead', l.name, l.company from public.leads l, k
  where public.has_permission('leads.create') and l.organization_id = public.current_org_id()
    and l.id is distinct from p_exclude
    and (lower(l.email) = k.email or right(regexp_replace(l.phone, '\D', '', 'g'), 10) = k.phone)
  union all
  select 'client', c.name, cl.company_name from public.client_contacts c join public.clients cl on cl.id = c.client_id, k
  where public.has_permission('leads.create') and c.organization_id = public.current_org_id()
    and (lower(c.email) = k.email or right(regexp_replace(c.phone, '\D', '', 'g'), 10) = k.phone)
  limit 5;
$$;

-- ───────────────────────── Won: convert to a client ─────────────────────────
-- p_client_id = an existing active client, or null to create one from the lead (company, plus the person as primary contact).
create function public.convert_lead(p_id uuid, p_client_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  org uuid := public.current_org_id();
  ld public.leads;
  cid uuid := p_client_id;
begin
  if org is null or not public.has_permission('leads.convert') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select * into ld from public.leads
  where id = p_id and organization_id = org
    and (public.has_permission('leads.view_all') or owner_id = auth.uid())
  for update;
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

revoke execute on function public.lead_owners, public.lead_duplicates, public.convert_lead from public, anon;
grant execute on function public.lead_owners, public.lead_duplicates, public.convert_lead to authenticated;
