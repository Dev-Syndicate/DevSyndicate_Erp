-- Quotations (PRD §11–§13) with server-side totals (PRD §9.3).
-- Clients can only read these tables; every write goes through the functions below, which check
-- permissions and recompute totals, so stored totals always match the line items.

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  number text,                                   -- assigned when first sent; revisions keep it
  revision int not null default 1 check (revision >= 1),
  previous_revision_id uuid references public.quotations(id),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'cancelled', 'superseded')),
  client_id uuid not null references public.clients(id),
  contact_id uuid references public.client_contacts(id),
  quotation_date date not null default public.ist_today(),
  valid_until date not null,
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  place_of_supply text not null default '',
  supply_type text not null default 'intra' check (supply_type in ('intra', 'inter', 'export')),
  gst_applicable boolean not null default false, -- company GST registration when saved
  discount_type text not null default 'amount' check (discount_type in ('amount', 'percent')),
  discount_value numeric(14,2) not null default 0 check (discount_value >= 0),
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  taxable_total numeric(14,2) not null default 0,
  cgst_total numeric(14,2) not null default 0,
  sgst_total numeric(14,2) not null default 0,
  igst_total numeric(14,2) not null default 0,
  round_off numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0 check (grand_total >= 0),
  terms text not null default '',
  notes text not null default '',
  sent_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until >= quotation_date),
  check (discount_type <> 'percent' or discount_value <= 100),
  check (status = 'draft' or number is not null)
);

create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  position int not null,
  description text not null check (length(trim(description)) > 0),
  sac_code text not null default '',
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  discount_type text not null default 'amount' check (discount_type in ('amount', 'percent')),
  discount_value numeric(14,2) not null default 0 check (discount_value >= 0),
  tax_rate numeric(5,2) not null default 0 check (tax_rate between 0 and 100),
  line_gross numeric(14,2) not null default 0,
  line_discount numeric(14,2) not null default 0,
  line_net numeric(14,2) not null default 0,
  allocated_discount numeric(14,2) not null default 0,
  taxable numeric(14,2) not null default 0 check (taxable >= 0),
  cgst numeric(14,2) not null default 0,
  sgst numeric(14,2) not null default 0,
  igst numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  check (discount_type <> 'percent' or discount_value <= 100),
  unique (quotation_id, position)
);

create unique index quotations_number_revision on public.quotations (organization_id, number, revision) where number is not null;
create index on public.quotations (organization_id, quotation_date desc);
create index on public.quotations (client_id);
create index on public.quotations (contact_id);
create index on public.quotations (previous_revision_id);
create index on public.quotation_items (quotation_id);
create index on public.quotation_items (organization_id);

create trigger set_updated_at before update on public.quotations for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.quotations for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.quotation_items for each row execute function public.audit_row_change();

alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;

create policy "quotations.view reads quotations" on public.quotations for select to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('quotations.view')));
create policy "quotations.view reads items" on public.quotation_items for select to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('quotations.view')));
create policy "quotations.delete removes drafts" on public.quotations for delete to authenticated
  using (organization_id = (select public.current_org_id()) and status = 'draft'
         and (select public.has_permission('quotations.delete')));

revoke all on public.quotations, public.quotation_items from anon;

-- ───────────────────────── Totals (PRD §9.3) ─────────────────────────
-- Rounding: round(x, 2) = half away from zero. Mirrored in src/lib/money.ts (keep in sync).

create function public.recalculate_quotation(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  q public.quotations;
  sum_net numeric;
  doc_discount numeric;
  last_line uuid;
  rounding boolean;
begin
  select * into strict q from public.quotations where id = p_id;

  -- 1–3: line gross, line discount, line net
  update public.quotation_items i
  set line_gross = round(i.quantity * i.unit_price, 2),
      line_discount = case when i.discount_type = 'percent'
                           then round(round(i.quantity * i.unit_price, 2) * i.discount_value / 100, 2)
                           else i.discount_value end
  where i.quotation_id = p_id;
  if exists (select 1 from public.quotation_items where quotation_id = p_id and line_discount > line_gross) then
    raise exception 'A line discount is larger than the line amount' using errcode = '22023';
  end if;
  update public.quotation_items set line_net = line_gross - line_discount where quotation_id = p_id;

  -- 4–5: document discount, allocated pro-rata by line net; rounding remainder goes to the last line
  select coalesce(sum(line_net), 0) into sum_net from public.quotation_items where quotation_id = p_id;
  doc_discount := case when q.discount_type = 'percent' then round(sum_net * q.discount_value / 100, 2)
                       else q.discount_value end;
  if doc_discount > sum_net then
    raise exception 'The discount is larger than the subtotal' using errcode = '22023';
  end if;
  update public.quotation_items
  set allocated_discount = case when sum_net = 0 then 0 else round(doc_discount * line_net / sum_net, 2) end
  where quotation_id = p_id;
  select id into last_line from public.quotation_items
  where quotation_id = p_id and line_net > 0 order by position desc limit 1;
  if last_line is not null then
    update public.quotation_items
    set allocated_discount = allocated_discount
      + (doc_discount - (select sum(allocated_discount) from public.quotation_items where quotation_id = p_id))
    where id = last_line;
  end if;

  -- 6: taxable value and tax, split CGST/SGST (intra-state) or IGST (inter-state); export is zero-rated
  update public.quotation_items i
  set taxable = t.taxable,
      cgst = case when q.supply_type = 'intra' then round(t.tax / 2, 2) else 0 end,
      sgst = case when q.supply_type = 'intra' then t.tax - round(t.tax / 2, 2) else 0 end,
      igst = case when q.supply_type = 'inter' then t.tax else 0 end,
      line_total = t.taxable + t.tax
  from (
    select id, line_net - allocated_discount as taxable,
           round((line_net - allocated_discount) * tax_rate / 100, 2) as tax
    from public.quotation_items where quotation_id = p_id
  ) t
  where i.id = t.id;

  -- 7–12: header totals and optional round-off to the nearest rupee
  select round_off into rounding from public.company_settings where organization_id = q.organization_id;
  update public.quotations h
  set subtotal = sum_net,
      discount_total = doc_discount,
      taxable_total = s.taxable,
      cgst_total = s.cgst,
      sgst_total = s.sgst,
      igst_total = s.igst,
      round_off = case when rounding then round(s.taxable + s.cgst + s.sgst + s.igst) - (s.taxable + s.cgst + s.sgst + s.igst) else 0 end,
      grand_total = case when rounding then round(s.taxable + s.cgst + s.sgst + s.igst) else s.taxable + s.cgst + s.sgst + s.igst end
  from (
    select coalesce(sum(taxable), 0) taxable, coalesce(sum(cgst), 0) cgst,
           coalesce(sum(sgst), 0) sgst, coalesce(sum(igst), 0) igst
    from public.quotation_items where quotation_id = p_id
  ) s
  where h.id = p_id;
end;
$$;

-- ───────────────────────── Save (create / edit draft) ─────────────────────────
-- p_data: { client_id, contact_id, quotation_date, valid_until, title, description, place_of_supply,
--           discount_type, discount_value, terms, notes,
--           items: [{ description, sac_code, quantity, unit_price, discount_type, discount_value, tax_rate }] }

create function public.save_quotation(p_id uuid, p_data jsonb) returns uuid
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
  elsif not exists (select 1 from public.quotations where id = qid and organization_id = org and status = 'draft') then
    raise exception 'Only draft quotations can be edited' using errcode = '22023';
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

-- ───────────────────────── Status changes ─────────────────────────

create function public.quotation_action(p_id uuid, p_action text) returns uuid
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
      (organization_id, quotation_id, position, description, sac_code, quantity, unit_price, discount_type, discount_value, tax_rate)
    select organization_id, new_id, position, description, sac_code, quantity, unit_price, discount_type, discount_value, tax_rate
    from public.quotation_items where quotation_id = p_id;
    perform public.recalculate_quotation(new_id);
    return new_id;

  else
    raise exception 'Unknown action %', p_action using errcode = '22023';
  end case;

  return p_id;
end;
$$;

revoke execute on function public.recalculate_quotation from public, anon, authenticated;
revoke execute on function public.save_quotation, public.quotation_action from public, anon;
grant execute on function public.save_quotation, public.quotation_action to authenticated;
