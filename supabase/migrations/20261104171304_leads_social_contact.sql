-- Instagram and LinkedIn leads may have only a handle or profile link (PRD §47): that is how you reach them.
alter table public.leads drop constraint leads_check;
alter table public.leads add constraint leads_contact_check
  check (email <> '' or phone <> '' or (source in ('instagram', 'linkedin') and trim(source_detail) <> ''));

-- '@RaoStudio', 'instagram.com/raostudio/' and 'https://www.instagram.com/raostudio?hl=en' are the same person.
create function public.lead_handle(p text) returns text
language sql immutable set search_path = '' as $$
  select nullif(regexp_replace(regexp_replace(regexp_replace(lower(trim(p)),
    '[?#].*$', ''),
    '^(https?://)?([a-z]+\.)?(instagram\.com|linkedin\.com)/(in/)?', ''),
    '^@|/+$', '', 'g'), '');
$$;
revoke execute on function public.lead_handle from public, anon, authenticated;

-- Duplicates also match the same handle on the same source (client contacts have no handle).
drop function public.lead_duplicates(text, text, uuid);
create function public.lead_duplicates(p_email text, p_phone text, p_exclude uuid default null, p_source text default '', p_source_detail text default '')
returns table (kind text, name text, detail text)
language sql stable security definer set search_path = '' as $$
  with k as (
    select nullif(lower(trim(p_email)), '') as email,
           nullif(right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10), '') as phone,
           case when p_source in ('instagram', 'linkedin') then public.lead_handle(p_source_detail) end as handle
  )
  select 'lead', l.name, l.company from public.leads l, k
  where public.has_permission('leads.create') and l.organization_id = public.current_org_id()
    and l.id is distinct from p_exclude
    and (lower(l.email) = k.email or right(regexp_replace(l.phone, '\D', '', 'g'), 10) = k.phone
         or (l.source = p_source and public.lead_handle(l.source_detail) = k.handle))
  union all
  select 'client', c.name, cl.company_name from public.client_contacts c join public.clients cl on cl.id = c.client_id, k
  where public.has_permission('leads.create') and c.organization_id = public.current_org_id()
    and (lower(c.email) = k.email or right(regexp_replace(c.phone, '\D', '', 'g'), 10) = k.phone)
  limit 5;
$$;
revoke execute on function public.lead_duplicates from public, anon;
grant execute on function public.lead_duplicates to authenticated;
