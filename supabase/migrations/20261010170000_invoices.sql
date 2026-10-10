-- Invoices (PRD §14–§17) and quotation → invoice conversion.
-- Like quotations: clients only read these tables; writes go through the functions below.
-- Status stores draft / issued / cancelled. Overdue, paid and partially paid are derived (payments come later).

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  number text,                                    -- assigned on issue (§30)
  status text not null default 'draft' check (status in ('draft', 'issued', 'cancelled')),
  quotation_id uuid references public.quotations(id),
  client_id uuid not null references public.clients(id),
  contact_id uuid references public.client_contacts(id),
  invoice_date date not null default public.ist_today(),
  due_date date not null,
  place_of_supply text not null default '',
  supply_type text not null default 'intra' check (supply_type in ('intra', 'inter', 'export')),
  gst_applicable boolean not null default false,
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
  -- Billing snapshot taken on issue, so later client edits don't change issued invoices (§15).
  billing_name text not null default '',
  billing_address text not null default '',
  billing_gstin text not null default '',
  lut_number text not null default '',            -- printed on export invoices
  over_quotation_reason text,                     -- set when issuing beyond the quotation total (§14)
  issued_at timestamptz,
  issued_by uuid references public.profiles(id),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date >= invoice_date),
  check (discount_type <> 'percent' or discount_value <= 100),
  check (status = 'draft' or number is not null)
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
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
  unique (invoice_id, position)
);

create unique index invoices_number on public.invoices (organization_id, number) where number is not null;
create index on public.invoices (organization_id, invoice_date desc);
create index on public.invoices (client_id);
create index on public.invoices (contact_id);
create index on public.invoices (quotation_id);
create index on public.invoices (issued_by);
create index on public.invoice_items (invoice_id);
create index on public.invoice_items (organization_id);

create trigger set_updated_at before update on public.invoices for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.invoices for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.invoice_items for each row execute function public.audit_row_change();

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

create policy "invoices.view reads invoices" on public.invoices for select to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('invoices.view')));
create policy "invoices.view reads items" on public.invoice_items for select to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('invoices.view')));
create policy "invoices.delete removes drafts" on public.invoices for delete to authenticated
  using (organization_id = (select public.current_org_id()) and status = 'draft'
         and (select public.has_permission('invoices.delete')));

revoke all on public.invoices, public.invoice_items from anon;

-- ───────────────────────── Totals (PRD §9.3), shared by quotations and invoices ─────────────────────────
-- Same steps as before, with the table chosen by p_doc. Mirrored in src/lib/money.ts (keep in sync).

create function public.recalculate_document(p_doc text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  hdr text;
  itm text;
  fk text;
  org uuid;
  d_type text;
  d_value numeric;
  supply text;
  sum_net numeric;
  doc_discount numeric;
  last_line uuid;
  bad boolean;
  rounding boolean;
begin
  if p_doc not in ('quotation', 'invoice') then
    raise exception 'unknown document type %', p_doc;
  end if;
  hdr := p_doc || 's';
  itm := p_doc || '_items';
  fk := p_doc || '_id';
  execute format('select organization_id, discount_type, discount_value, supply_type from public.%I where id = $1', hdr)
    into strict org, d_type, d_value, supply using p_id;

  -- 1–3: line gross, line discount, line net
  execute format($q$
    update public.%I i
    set line_gross = round(i.quantity * i.unit_price, 2),
        line_discount = case when i.discount_type = 'percent'
                             then round(round(i.quantity * i.unit_price, 2) * i.discount_value / 100, 2)
                             else i.discount_value end
    where i.%I = $1$q$, itm, fk) using p_id;
  execute format('select exists (select 1 from public.%I where %I = $1 and line_discount > line_gross)', itm, fk)
    into bad using p_id;
  if bad then
    raise exception 'A line discount is larger than the line amount' using errcode = '22023';
  end if;
  execute format('update public.%I set line_net = line_gross - line_discount where %I = $1', itm, fk) using p_id;

  -- 4–5: document discount, allocated pro-rata by line net; rounding remainder goes to the last line
  execute format('select coalesce(sum(line_net), 0) from public.%I where %I = $1', itm, fk) into sum_net using p_id;
  doc_discount := case when d_type = 'percent' then round(sum_net * d_value / 100, 2) else d_value end;
  if doc_discount > sum_net then
    raise exception 'The discount is larger than the subtotal' using errcode = '22023';
  end if;
  execute format($q$
    update public.%I
    set allocated_discount = case when $2 = 0 then 0 else round($3 * line_net / $2, 2) end
    where %I = $1$q$, itm, fk) using p_id, sum_net, doc_discount;
  execute format('select id from public.%I where %I = $1 and line_net > 0 order by position desc limit 1', itm, fk)
    into last_line using p_id;
  if last_line is not null then
    execute format($q$
      update public.%I
      set allocated_discount = allocated_discount + ($2 - (select sum(allocated_discount) from public.%I where %I = $3))
      where id = $1$q$, itm, itm, fk) using last_line, doc_discount, p_id;
  end if;

  -- 6: taxable value and tax, split CGST/SGST (intra-state) or IGST (inter-state); export is zero-rated
  execute format($q$
    update public.%I i
    set taxable = t.taxable,
        cgst = case when $2 = 'intra' then round(t.tax / 2, 2) else 0 end,
        sgst = case when $2 = 'intra' then t.tax - round(t.tax / 2, 2) else 0 end,
        igst = case when $2 = 'inter' then t.tax else 0 end,
        line_total = t.taxable + t.tax
    from (
      select id, line_net - allocated_discount as taxable,
             round((line_net - allocated_discount) * tax_rate / 100, 2) as tax
      from public.%I where %I = $1
    ) t
    where i.id = t.id$q$, itm, itm, fk) using p_id, supply;

  -- 7–12: header totals and optional round-off to the nearest rupee
  select round_off into rounding from public.company_settings where organization_id = org;
  execute format($q$
    update public.%I h
    set subtotal = $2,
        discount_total = $3,
        taxable_total = s.taxable,
        cgst_total = s.cgst,
        sgst_total = s.sgst,
        igst_total = s.igst,
        round_off = case when $4 then round(s.taxable + s.cgst + s.sgst + s.igst) - (s.taxable + s.cgst + s.sgst + s.igst) else 0 end,
        grand_total = case when $4 then round(s.taxable + s.cgst + s.sgst + s.igst) else s.taxable + s.cgst + s.sgst + s.igst end
    from (
      select coalesce(sum(taxable), 0) taxable, coalesce(sum(cgst), 0) cgst,
             coalesce(sum(sgst), 0) sgst, coalesce(sum(igst), 0) igst
      from public.%I where %I = $1
    ) s
    where h.id = $1$q$, hdr, itm, fk) using p_id, sum_net, doc_discount, rounding;
end;
$$;

-- Existing quotation functions call this; it now delegates to the shared calculation.
create or replace function public.recalculate_quotation(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  select public.recalculate_document('quotation', p_id);
$$;

revoke execute on function public.recalculate_document from public, anon, authenticated;

-- ───────────────────────── Save (create / edit draft) ─────────────────────────
-- p_data: { client_id, contact_id, invoice_date, due_date, place_of_supply, discount_type, discount_value,
--           terms, notes, items: [{ description, sac_code, quantity, unit_price, discount_type, discount_value, tax_rate }] }

create function public.save_invoice(p_id uuid, p_data jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  org uuid := public.current_org_id();
  iid uuid := p_id;
  cs public.company_settings;
  cl public.clients;
  pos text := coalesce(nullif(trim(p_data->>'place_of_supply'), ''), '');
  supply text;
begin
  if org is null or not public.has_permission(case when p_id is null then 'invoices.create' else 'invoices.update' end) then
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

  if iid is null then
    insert into public.invoices (organization_id, client_id, invoice_date, due_date)
    values (org, cl.id, coalesce((p_data->>'invoice_date')::date, public.ist_today()), (p_data->>'due_date')::date)
    returning id into iid;
  else
    -- Row lock: waits for a concurrent issue, then re-checks the status.
    perform 1 from public.invoices where id = iid and organization_id = org and status = 'draft' for update;
    if not found then
      raise exception 'Only draft invoices can be edited' using errcode = '22023';
    end if;
  end if;

  update public.invoices
  set client_id = cl.id,
      contact_id = nullif(p_data->>'contact_id', '')::uuid,
      invoice_date = coalesce((p_data->>'invoice_date')::date, public.ist_today()),
      due_date = (p_data->>'due_date')::date,
      place_of_supply = pos,
      supply_type = supply,
      gst_applicable = cs.gst_registered,
      discount_type = coalesce(p_data->>'discount_type', 'amount'),
      discount_value = coalesce((p_data->>'discount_value')::numeric, 0),
      terms = coalesce(p_data->>'terms', ''),
      notes = coalesce(p_data->>'notes', '')
  where id = iid;

  delete from public.invoice_items where invoice_id = iid;
  insert into public.invoice_items
    (organization_id, invoice_id, position, description, sac_code, quantity, unit_price,
     discount_type, discount_value, tax_rate)
  select org, iid, ord::int, item->>'description', coalesce(item->>'sac_code', ''),
         (item->>'quantity')::numeric, (item->>'unit_price')::numeric,
         coalesce(item->>'discount_type', 'amount'), coalesce((item->>'discount_value')::numeric, 0),
         -- No tax without GST registration; exports under LUT are zero-rated (PRD §15).
         case when cs.gst_registered and supply <> 'export' then coalesce((item->>'tax_rate')::numeric, 0) else 0 end
  from jsonb_array_elements(p_data->'items') with ordinality as x(item, ord);

  perform public.recalculate_document('invoice', iid);
  return iid;
end;
$$;

-- ───────────────────────── Issue / cancel / duplicate ─────────────────────────
-- Issuing beyond the quotation total needs quotations.convert and a reason (PRD §14, §46 Q6);
-- without a reason it fails with hint 'override_reason' so the app can ask for one.

create function public.invoice_action(p_id uuid, p_action text, p_reason text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  org uuid := public.current_org_id();
  inv public.invoices;
  cs public.company_settings;
  cl public.clients;
  quoted numeric;
  invoiced numeric;
  new_id uuid;
begin
  select * into inv from public.invoices where id = p_id and organization_id = org for update;
  if inv.id is null then
    raise exception 'Invoice not found' using errcode = '22023';
  end if;

  case p_action
  when 'issue' then
    if not public.has_permission('invoices.issue') then raise exception 'permission denied' using errcode = '42501'; end if;
    if inv.status <> 'draft' then raise exception 'Only drafts can be issued' using errcode = '22023'; end if;
    select * into strict cs from public.company_settings where organization_id = org;
    if inv.gst_applicable <> cs.gst_registered then
      raise exception 'Your GST registration changed since this draft was saved. Edit and save it again before issuing.' using errcode = '22023';
    end if;

    if inv.quotation_id is not null then
      select grand_total into quoted from public.quotations where id = inv.quotation_id for update;
      select coalesce(sum(grand_total), 0) + inv.grand_total into invoiced
      from public.invoices where quotation_id = inv.quotation_id and status = 'issued';
      if invoiced > quoted then
        if not public.has_permission('quotations.convert') then
          raise exception 'This invoice would take the total invoiced past the quotation total' using errcode = '22023';
        end if;
        if nullif(trim(coalesce(p_reason, '')), '') is null then
          raise exception 'This invoice takes the total invoiced past the quotation total. Give a reason to continue.'
            using errcode = '22023', hint = 'override_reason';
        end if;
      end if;
    end if;

    select * into strict cl from public.clients where id = inv.client_id;
    update public.invoices
    set status = 'issued',
        number = public.next_document_number('invoice', inv.invoice_date),
        issued_at = now(),
        issued_by = auth.uid(),
        billing_name = cl.company_name,
        billing_address = concat_ws(', ', nullif(cl.billing_address, ''), nullif(cl.city, ''), nullif(cl.state, ''),
                                    nullif(cl.pin_code, ''), nullif(cl.country, '')),
        billing_gstin = cl.gstin,
        lut_number = case when inv.supply_type = 'export' then cs.lut_number else '' end,
        over_quotation_reason = case when invoiced > quoted then trim(p_reason) end
    where id = p_id;

  when 'cancel' then
    if not public.has_permission('invoices.cancel') then raise exception 'permission denied' using errcode = '42501'; end if;
    if inv.status <> 'issued' then raise exception 'Only issued invoices can be cancelled' using errcode = '22023'; end if;
    -- shortcut: no payments yet; once payment_allocations exist, refuse while confirmed allocations remain (PRD §16).
    update public.invoices set status = 'cancelled' where id = p_id;

  when 'duplicate' then
    if not public.has_permission('invoices.create') then raise exception 'permission denied' using errcode = '42501'; end if;
    insert into public.invoices
      (organization_id, client_id, contact_id, invoice_date, due_date, place_of_supply, supply_type, gst_applicable,
       discount_type, discount_value, terms, notes)
    select organization_id, client_id, contact_id, public.ist_today(), public.ist_today() + (due_date - invoice_date),
           place_of_supply, supply_type, gst_applicable, discount_type, discount_value, terms, notes
    from public.invoices where id = p_id
    returning id into new_id;
    insert into public.invoice_items
      (organization_id, invoice_id, position, description, sac_code, quantity, unit_price, discount_type, discount_value, tax_rate)
    select organization_id, new_id, position, description, sac_code, quantity, unit_price, discount_type, discount_value, tax_rate
    from public.invoice_items where invoice_id = p_id;
    perform public.recalculate_document('invoice', new_id);
    return new_id;

  else
    raise exception 'Unknown action %', p_action using errcode = '22023';
  end case;

  return p_id;
end;
$$;

-- ───────────────────────── Quotation → invoice (PRD §14) ─────────────────────────
-- p_mode: 'full'    copy every line as quoted
--         'percent' one line per quotation line at p_percent of its value ("50% advance — …")
--         'items'   p_items = [{ id, quantity }]: chosen lines and quantities
-- Partial modes fold each line's share of the document discount into the line, so taxable values match the quotation.

create function public.convert_quotation(p_id uuid, p_mode text, p_percent numeric default null, p_items jsonb default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  org uuid := public.current_org_id();
  q public.quotations;
  cs public.company_settings;
  terms_days int;
  items jsonb;
  iid uuid;
begin
  if org is null or not public.has_permission('quotations.convert') or not public.has_permission('invoices.create') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select * into q from public.quotations where id = p_id and organization_id = org;
  if q.id is null then
    raise exception 'Quotation not found' using errcode = '22023';
  end if;
  if q.status <> 'accepted' then
    raise exception 'Only accepted quotations can be converted' using errcode = '22023';
  end if;
  select * into strict cs from public.company_settings where organization_id = org;
  select coalesce(payment_terms_days, cs.payment_terms_days) into terms_days from public.clients where id = q.client_id;

  if p_mode = 'full' then
    select jsonb_agg(jsonb_build_object(
             'description', description, 'sac_code', sac_code, 'quantity', quantity, 'unit_price', unit_price,
             'discount_type', discount_type, 'discount_value', discount_value, 'tax_rate', tax_rate) order by position)
    into items from public.quotation_items where quotation_id = p_id;
  elsif p_mode = 'percent' then
    if p_percent is null or p_percent <= 0 or p_percent > 100 or p_percent <> round(p_percent, 2) then
      raise exception 'Enter a percentage between 0.01 and 100' using errcode = '22023';
    end if;
    select jsonb_agg(jsonb_build_object(
             'description', trim(to_char(p_percent, 'FM990.99'), '.') || '% — ' || description,
             'sac_code', sac_code, 'quantity', 1, 'unit_price', round(line_gross * p_percent / 100, 2),
             'discount_type', 'amount', 'discount_value', round((line_discount + allocated_discount) * p_percent / 100, 2),
             'tax_rate', tax_rate) order by position)
    into items from public.quotation_items where quotation_id = p_id;
  elsif p_mode = 'items' then
    if jsonb_array_length(coalesce(p_items, '[]')) = 0 then
      raise exception 'Select at least one line' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_array_elements(p_items) x
               where not exists (select 1 from public.quotation_items where id = (x->>'id')::uuid and quotation_id = p_id)
                  or (x->>'quantity')::numeric <= 0) then
      raise exception 'Choose lines from this quotation with a quantity above 0' using errcode = '22023';
    end if;
    select jsonb_agg(jsonb_build_object(
             'description', qi.description, 'sac_code', qi.sac_code, 'quantity', (x->>'quantity')::numeric,
             'unit_price', qi.unit_price, 'discount_type', 'amount',
             'discount_value', round((qi.line_discount + qi.allocated_discount) * (x->>'quantity')::numeric / qi.quantity, 2),
             'tax_rate', qi.tax_rate) order by qi.position)
    into items
    from jsonb_array_elements(p_items) x join public.quotation_items qi on qi.id = (x->>'id')::uuid;
  else
    raise exception 'Unknown conversion mode %', p_mode using errcode = '22023';
  end if;

  iid := public.save_invoice(null, jsonb_build_object(
    'client_id', q.client_id,
    'contact_id', coalesce(q.contact_id::text, ''),
    'invoice_date', public.ist_today(),
    'due_date', public.ist_today() + terms_days,
    'place_of_supply', q.place_of_supply,
    'discount_type', q.discount_type,
    'discount_value', case when p_mode = 'full' then q.discount_value else 0 end,
    'terms', cs.invoice_terms,
    'notes', q.notes,
    'items', items));
  update public.invoices set quotation_id = p_id where id = iid;
  return iid;
end;
$$;

-- Σ grand totals of issued invoices for a quotation. PostgREST computed field: select=invoiced_total.
create function public.invoiced_total(q public.quotations) returns numeric
language sql stable set search_path = '' as $$
  select coalesce(sum(grand_total), 0) from public.invoices where quotation_id = q.id and status = 'issued';
$$;

revoke execute on function public.save_invoice, public.invoice_action, public.convert_quotation, public.invoiced_total from public, anon;
grant execute on function public.save_invoice, public.invoice_action, public.convert_quotation, public.invoiced_total to authenticated;
