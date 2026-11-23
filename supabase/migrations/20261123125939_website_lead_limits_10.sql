-- Website form limits raised to 10 enquiries per visitor an hour and 10 per email a day (owner decision, PRD §47).

create or replace function public.submit_website_lead(p_key text, p_name text, p_email text, p_company text, p_need text, p_message text,
                                           p_ip text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  org uuid;
  v_email text := lower(trim(p_email));
  v_ip text;
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
          public.ist_today(), 'Reply to website enquiry', null, v_ip);
end;
$$;
