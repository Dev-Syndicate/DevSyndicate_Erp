-- 1. save_quotation: lock the draft before editing, so a concurrent "send" can't be overwritten.
-- 2. extend_quotation_validity: an expired quotation can be accepted after extending its validity (PRD §12).
-- 3. One primary contact per client, kept by the database in the same statement.

create or replace function public.save_quotation(p_id uuid, p_data jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  org uuid := public.current_org_id();
  qid uuid := p_id;
  cs public.company_settings;
  cl public.clients;
  pos text := coalesce(nullif(trim(p_data->>'place_of_supply'), ''), '');
  supply text;
begin
  if org is null or not public.has_permission(case when p_id is null then 'quotations.create' else 'quotations.update' end) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(p_data->'items', '[]')) = 0 then
    raise exception 'Add at least one line item' using errcode = '22023';
  end if;

  select * into strict cs from public.company_settings where organization_id = org;
  select * into cl from public.clients
  where id = (p_data->>'client_id')::uuid and organization_id = org and deleted_at is null;
  if cl.id is null then
    raise exception 'Select an active client' using errcode = '22023';
  end if;
  if nullif(p_data->>'contact_id', '') is not null and not exists (
    select 1 from public.client_contacts where id = (p_data->>'contact_id')::uuid and client_id = cl.id
  ) then
    raise exception 'The contact does not belong to this client' using errcode = '22023';
  end if;

  if pos = '' then pos := cl.state; end if;
  supply := case when cl.country <> 'India' then 'export'
                 when pos = cs.state then 'intra'
                 else 'inter' end;

  if qid is null then
    insert into public.quotations (organization_id, client_id, quotation_date, valid_until, title)
    values (org, cl.id, coalesce((p_data->>'quotation_date')::date, public.ist_today()),
            (p_data->>'valid_until')::date, p_data->>'title')
    returning id into qid;
  else
    -- Row lock: waits for a concurrent send, then re-checks the status.
    perform 1 from public.quotations where id = qid and organization_id = org and status = 'draft' for update;
    if not found then
      raise exception 'Only draft quotations can be edited' using errcode = '22023';
    end if;
  end if;

  update public.quotations
  set client_id = cl.id,
      contact_id = nullif(p_data->>'contact_id', '')::uuid,
      quotation_date = coalesce((p_data->>'quotation_date')::date, public.ist_today()),
      valid_until = (p_data->>'valid_until')::date,
      title = p_data->>'title',
      description = coalesce(p_data->>'description', ''),
      place_of_supply = pos,
      supply_type = supply,
      gst_applicable = cs.gst_registered,
      discount_type = coalesce(p_data->>'discount_type', 'amount'),
      discount_value = coalesce((p_data->>'discount_value')::numeric, 0),
      terms = coalesce(p_data->>'terms', ''),
      notes = coalesce(p_data->>'notes', '')
  where id = qid;

  delete from public.quotation_items where quotation_id = qid;
  insert into public.quotation_items
    (organization_id, quotation_id, position, description, sac_code, quantity, unit_price,
     discount_type, discount_value, tax_rate)
  select org, qid, ord::int, item->>'description', coalesce(item->>'sac_code', ''),
         (item->>'quantity')::numeric, (item->>'unit_price')::numeric,
         coalesce(item->>'discount_type', 'amount'), coalesce((item->>'discount_value')::numeric, 0),
         -- No tax without GST registration; exports under LUT are zero-rated (PRD §15).
         case when cs.gst_registered and supply <> 'export' then coalesce((item->>'tax_rate')::numeric, 0) else 0 end
  from jsonb_array_elements(p_data->'items') with ordinality as x(item, ord);

  perform public.recalculate_quotation(qid);
  return qid;
end;
$$;

-- Extends a sent quotation's validity. The audit trigger logs the old and new date.
create function public.extend_quotation_validity(p_id uuid, p_valid_until date) returns void
language plpgsql security definer set search_path = '' as $$
declare
  q public.quotations;
begin
  if not public.has_permission('quotations.update') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select * into q from public.quotations where id = p_id and organization_id = public.current_org_id() for update;
  if q.id is null then
    raise exception 'Quotation not found' using errcode = '22023';
  end if;
  if q.status <> 'sent' then
    raise exception 'Only sent quotations can be extended' using errcode = '22023';
  end if;
  if p_valid_until is null or p_valid_until < public.ist_today() then
    raise exception 'Pick a date from today onwards' using errcode = '22023';
  end if;
  update public.quotations set valid_until = p_valid_until where id = p_id;
end;
$$;

revoke execute on function public.extend_quotation_validity from public, anon;
grant execute on function public.extend_quotation_validity to authenticated;

-- Marking a contact primary un-marks the others first (runs before the one-primary unique index check).
create function public.unset_other_primary_contacts() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.client_contacts set is_primary = false
  where client_id = new.client_id and is_primary and id <> new.id;
  return new;
end;
$$;

revoke execute on function public.unset_other_primary_contacts from public, anon, authenticated;

create trigger one_primary_contact before insert or update of is_primary on public.client_contacts
  for each row when (new.is_primary) execute function public.unset_other_primary_contacts();
