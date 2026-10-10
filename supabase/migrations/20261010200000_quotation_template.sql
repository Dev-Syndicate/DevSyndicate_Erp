-- Quotation template fields (owner's quotation design):
-- 1. quotation_items.timeline: optional per-line estimate ("2 days"), shown as a Timeline column on the PDF.
-- 2. company_settings.signatory_designation: printed under the signature ("Founder & CEO").
-- save_quotation and quotation_action are unchanged apart from carrying timeline.

alter table public.quotation_items add column timeline text not null default '' check (length(timeline) <= 50);
alter table public.company_settings add column signatory_designation text not null default '';

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
    (organization_id, quotation_id, position, description, sac_code, timeline, quantity, unit_price,
     discount_type, discount_value, tax_rate)
  select org, qid, ord::int, item->>'description', coalesce(item->>'sac_code', ''), coalesce(trim(item->>'timeline'), ''),
         (item->>'quantity')::numeric, (item->>'unit_price')::numeric,
         coalesce(item->>'discount_type', 'amount'), coalesce((item->>'discount_value')::numeric, 0),
         -- No tax without GST registration; exports under LUT are zero-rated (PRD §15).
         case when cs.gst_registered and supply <> 'export' then coalesce((item->>'tax_rate')::numeric, 0) else 0 end
  from jsonb_array_elements(p_data->'items') with ordinality as x(item, ord);

  perform public.recalculate_quotation(qid);
  return qid;
end;
$$;

create or replace function public.quotation_action(p_id uuid, p_action text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  org uuid := public.current_org_id();
  q public.quotations;
  new_id uuid;
begin
  select * into q from public.quotations where id = p_id and organization_id = org for update;
  if q.id is null then
    raise exception 'Quotation not found' using errcode = '22023';
  end if;

  case p_action
  when 'send' then
    if not public.has_permission('quotations.send') then raise exception 'permission denied' using errcode = '42501'; end if;
    if q.status <> 'draft' then raise exception 'Only drafts can be sent' using errcode = '22023'; end if;
    update public.quotations
    set status = 'sent', sent_at = now(), number = coalesce(number, public.next_document_number('quotation', quotation_date))
    where id = p_id;
    -- Sending a revision replaces the one it was revised from (PRD §13).
    update public.quotations set status = 'superseded'
    where id = q.previous_revision_id and status = 'sent';

  when 'accept', 'reject' then
    if not public.has_permission('quotations.update') then raise exception 'permission denied' using errcode = '42501'; end if;
    if q.status <> 'sent' then raise exception 'Only sent quotations can be accepted or rejected' using errcode = '22023'; end if;
    if p_action = 'accept' and q.valid_until < public.ist_today() then
      raise exception 'This quotation has expired; revise it with a new validity date first' using errcode = '22023';
    end if;
    update public.quotations set status = case when p_action = 'accept' then 'accepted' else 'rejected' end where id = p_id;

  when 'cancel' then
    if not public.has_permission('quotations.update') then raise exception 'permission denied' using errcode = '42501'; end if;
    if q.status not in ('sent', 'accepted') then raise exception 'Only sent or accepted quotations can be cancelled' using errcode = '22023'; end if;
    update public.quotations set status = 'cancelled' where id = p_id;

  when 'revise', 'duplicate' then
    if not public.has_permission(case when p_action = 'revise' then 'quotations.update' else 'quotations.create' end) then
      raise exception 'permission denied' using errcode = '42501';
    end if;
    if p_action = 'revise' and q.status not in ('sent', 'rejected') then
      raise exception 'Only sent or rejected quotations can be revised' using errcode = '22023';
    end if;
    if p_action = 'revise' and exists (select 1 from public.quotations where previous_revision_id = p_id) then
      raise exception 'This quotation already has a newer revision' using errcode = '22023';
    end if;
    insert into public.quotations
      (organization_id, number, revision, previous_revision_id, client_id, contact_id, quotation_date, valid_until,
       title, description, place_of_supply, supply_type, gst_applicable, discount_type, discount_value, terms, notes)
    select organization_id,
           case when p_action = 'revise' then number end,
           case when p_action = 'revise' then revision + 1 else 1 end,
           case when p_action = 'revise' then id end,
           client_id, contact_id, public.ist_today(),
           public.ist_today() + (valid_until - quotation_date),
           title, description, place_of_supply, supply_type, gst_applicable, discount_type, discount_value, terms, notes
    from public.quotations where id = p_id
    returning id into new_id;
    insert into public.quotation_items
      (organization_id, quotation_id, position, description, sac_code, timeline, quantity, unit_price, discount_type, discount_value, tax_rate)
    select organization_id, new_id, position, description, sac_code, timeline, quantity, unit_price, discount_type, discount_value, tax_rate
    from public.quotation_items where quotation_id = p_id;
    perform public.recalculate_quotation(new_id);
    return new_id;

  else
    raise exception 'Unknown action %', p_action using errcode = '22023';
  end case;

  return p_id;
end;
$$;
