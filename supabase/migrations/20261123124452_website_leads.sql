-- Website contact form → Leads (PRD §47, v1.7). The website's server posts enquiries with a form key; only its
-- SHA-256 hash is stored. submit_website_lead is the one door for anon: it checks the key and inserts a Website lead.

alter table public.company_settings
  add column website_form_key_hash text check (website_form_key_hash ~ '^[0-9a-f]{64}$');

create function public.submit_website_lead(p_key text, p_name text, p_email text, p_company text, p_need text, p_message text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  org uuid;
  v_email text := lower(trim(p_email));
begin
  select organization_id into org from public.company_settings
  where website_form_key_hash = encode(sha256(convert_to(coalesce(p_key, ''), 'UTF8')), 'hex');
  if org is null then
    raise exception 'Invalid form key' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_message, ''))) not between 1 and 4000 or length(coalesce(p_need, '')) > 100 then
    raise exception 'Invalid enquiry' using errcode = '22023';
  end if;
  -- Double submit: the same person within 10 minutes is the same enquiry.
  if exists (select 1 from public.leads where organization_id = org and source = 'website' and email = v_email
             and created_at > now() - interval '10 minutes') then
    return;
  end if;
  -- A leaked key can't flood the leads list.
  if (select count(*) from public.leads where organization_id = org and source = 'website' and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many enquiries, try again later' using errcode = '54000';
  end if;

  -- created_by stays null: the list shows "Website form".
  insert into public.leads (organization_id, name, company, email, source, source_detail, notes, next_follow_up, follow_up_note, created_by)
  values (org, trim(p_name), trim(coalesce(p_company, '')), v_email, 'website', 'Contact form',
          case when trim(coalesce(p_need, '')) <> '' then 'Needs: ' || trim(p_need) || E'\n\n' else '' end || trim(p_message),
          public.ist_today(), 'Reply to website enquiry', null);
end;
$$;

revoke execute on function public.submit_website_lead from public, authenticated;
grant execute on function public.submit_website_lead to anon;

-- Live pop-up for new website enquiries; Realtime applies leads RLS to each subscriber.
alter publication supabase_realtime add table public.leads;
