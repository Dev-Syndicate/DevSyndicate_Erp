-- Notifications (PRD §50, v1.7): one row per recipient, read/unread per person, created only by database functions.
-- First sender: the website contact form (§47). No Realtime (owner decision): the bell updates on page load.

alter publication supabase_realtime drop table public.leads;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('website_enquiry')),
  title text not null check (length(title) between 1 and 200),
  body text not null default '' check (length(body) <= 500),
  link text not null default '' check (link = '' or link ~ '^/'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index on public.notifications (user_id, created_at desc);
create index on public.notifications (organization_id);

create trigger audit after insert or update or delete on public.notifications for each row execute function public.audit_row_change();

alter table public.notifications enable row level security;

create policy "users read own notifications" on public.notifications for select to authenticated
  using (organization_id = (select public.current_org_id()) and user_id = (select auth.uid()));
create policy "users mark own notifications read" on public.notifications for update to authenticated
  using (organization_id = (select public.current_org_id()) and user_id = (select auth.uid()))
  with check (organization_id = (select public.current_org_id()) and user_id = (select auth.uid()));

-- Users may only set read_at; everything else is written by notify().
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Sends a notification to every active user in the organisation who has p_permission. Internal: other database functions call it.
create function public.notify(p_org uuid, p_permission text, p_kind text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (organization_id, user_id, kind, title, body, link)
  select distinct p.organization_id, p.id, p_kind, left(p_title, 200), left(coalesce(p_body, ''), 500), coalesce(p_link, '')
  from public.profiles p join public.role_permissions rp on rp.role_id = p.role_id
  where p.organization_id = p_org and p.is_active and rp.permission = p_permission;
$$;

revoke execute on function public.notify from public, anon, authenticated;

-- Website form: same as before, plus a notification to everyone who sees leads.
create or replace function public.submit_website_lead(p_key text, p_name text, p_email text, p_company text, p_need text, p_message text,
                                           p_ip text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  org uuid;
  v_email text := lower(trim(p_email));
  v_ip text;
  v_id uuid;
begin
  select organization_id into org from public.company_settings
  where website_form_key_hash = encode(sha256(convert_to(coalesce(p_key, ''), 'UTF8')), 'hex');
  if org is null then
    raise exception 'Invalid form key' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_message, ''))) not between 1 and 4000 or length(coalesce(p_need, '')) > 100 then
    raise exception 'Invalid enquiry' using errcode = '22023';
  end if;
  -- Salted with the organisation so the stored hash can't be matched against other systems.
  v_ip := case when nullif(trim(p_ip), '') is not null
               then encode(sha256(convert_to(org::text || '|' || lower(trim(p_ip)), 'UTF8')), 'hex') end;

  -- Double submit: the same person within 10 minutes is the same enquiry.
  if exists (select 1 from public.leads where organization_id = org and source = 'website' and email = v_email
             and created_at > now() - interval '10 minutes') then
    return;
  end if;
  if v_ip is not null and (select count(*) from public.leads where organization_id = org and source = 'website'
                           and visitor_ip_hash = v_ip and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many enquiries from this visitor, try again later' using errcode = '54000';
  end if;
  if (select count(*) from public.leads where organization_id = org and source = 'website' and email = v_email
      and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Too many enquiries from this email, try again tomorrow' using errcode = '54000';
  end if;
  -- A leaked key can't flood the leads list.
  if (select count(*) from public.leads where organization_id = org and source = 'website' and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many enquiries, try again later' using errcode = '54000';
  end if;

  -- created_by stays null: the lead shows "Website form".
  insert into public.leads (organization_id, name, company, email, source, source_detail, notes, next_follow_up, follow_up_note,
                            created_by, visitor_ip_hash)
  values (org, trim(p_name), trim(coalesce(p_company, '')), v_email, 'website', 'Contact form',
          case when trim(coalesce(p_need, '')) <> '' then 'Needs: ' || trim(p_need) || E'\n\n' else '' end || trim(p_message),
          public.ist_today(), 'Reply to website enquiry', null, v_ip)
  returning id into v_id;

  perform public.notify(org, 'leads.view', 'website_enquiry', 'New website enquiry from ' || trim(p_name),
                        concat_ws(' · ', nullif(trim(coalesce(p_company, '')), ''), nullif(trim(coalesce(p_need, '')), '')),
                        '/leads/' || v_id);
end;
$$;
