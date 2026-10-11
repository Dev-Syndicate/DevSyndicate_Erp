-- Credit notes (PRD §18, v1.3): reduce what is owed on an issued invoice (price correction, discount after the
-- fact, cancelled scope). Tax reverses at the original invoice's supply type and rates (Section 34, Rule 53).
-- Clients only read these tables; writes go through the functions below.

create table public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  number text,                                    -- assigned on issue (§30, ≤ 16 characters)
  status text not null default 'draft' check (status in ('draft', 'issued', 'cancelled')),
  invoice_id uuid not null references public.invoices(id),
  client_id uuid not null references public.clients(id),
  credit_note_date date not null default public.ist_today(),
  reason text not null check (length(trim(reason)) > 0),
  -- Copied from the invoice: tax follows the original supply.
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
  notes text not null default '',
  -- Recipient as on the invoice (Rule 53: recipient details).
  billing_name text not null default '',
  billing_address text not null default '',
  billing_gstin text not null default '',
  issued_at timestamptz,
  issued_by uuid references public.profiles(id),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_type <> 'percent' or discount_value <= 100),
  check (status = 'draft' or number is not null)
);

create table public.credit_note_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  credit_note_id uuid not null references public.credit_notes(id) on delete cascade,
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
  unique (credit_note_id, position)
);

create unique index credit_notes_number on public.credit_notes (organization_id, number) where number is not null;
create index on public.credit_notes (organization_id, credit_note_date desc);
create index on public.credit_notes (invoice_id);
create index on public.credit_notes (client_id);
create index on public.credit_notes (issued_by);
create index on public.credit_note_items (credit_note_id);
create index on public.credit_note_items (organization_id);

create trigger set_updated_at before update on public.credit_notes for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.credit_notes for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.credit_note_items for each row execute function public.audit_row_change();

alter table public.credit_notes enable row level security;
alter table public.credit_note_items enable row level security;

create policy "credit_notes.view reads credit notes" on public.credit_notes for select to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('credit_notes.view')));
create policy "credit_notes.view reads items" on public.credit_note_items for select to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('credit_notes.view')));
create policy "credit_notes.create removes drafts" on public.credit_notes for delete to authenticated
  using (organization_id = (select public.current_org_id()) and status = 'draft'
         and (select public.has_permission('credit_notes.create')));

revoke all on public.credit_notes, public.credit_note_items from anon;

-- Shared totals now also cover credit notes.
create or replace function public.recalculate_document(p_doc text, p_id uuid) returns void
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
  if p_doc not in ('quotation', 'invoice', 'credit_note') then
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

-- ───────────────────────── Invoice balance with credit notes (§9.2) ─────────────────────────

-- Σ issued credit notes against an invoice.
create function public.amount_credited(public.invoices) returns numeric
language sql stable set search_path = '' as $$
  select coalesce(sum(grand_total), 0) from public.credit_notes where invoice_id = $1.id and status = 'issued';
$$;

create or replace function public.balance_due(public.invoices) returns numeric
language sql stable set search_path = '' as $$
  select $1.grand_total - public.amount_credited($1) - public.amount_paid($1);
$$;

revoke execute on function public.amount_credited from public, anon;
grant execute on function public.amount_credited to authenticated;

-- ───────────────────────── Save (create / edit draft) ─────────────────────────
-- p_data: { invoice_id, credit_note_date, reason, discount_type, discount_value, notes,
--           items: [{ description, sac_code, quantity, unit_price, discount_type, discount_value, tax_rate }] }

create function public.save_credit_note(p_id uuid, p_data jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  org uuid := public.current_org_id();
  cid uuid := p_id;
  inv public.invoices;
begin
  if org is null or not public.has_permission('credit_notes.create') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(p_data->'items', '[]')) = 0 then
    raise exception 'Add at least one line item' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_data->>'reason', '')), '') is null then
    raise exception 'Give the reason for the credit note' using errcode = '22023';
  end if;
  select * into inv from public.invoices
  where id = (p_data->>'invoice_id')::uuid and organization_id = org and status = 'issued';
  if inv.id is null then
    raise exception 'Choose an issued invoice' using errcode = '22023';
  end if;

  if cid is null then
    insert into public.credit_notes (organization_id, invoice_id, client_id, reason)
    values (org, inv.id, inv.client_id, trim(p_data->>'reason'))
    returning id into cid;
  else
    -- Row lock: waits for a concurrent issue, then re-checks the status.
    perform 1 from public.credit_notes where id = cid and organization_id = org and status = 'draft' for update;
    if not found then
      raise exception 'Only draft credit notes can be edited' using errcode = '22023';
    end if;
  end if;

  update public.credit_notes
  set invoice_id = inv.id,
      client_id = inv.client_id,
      credit_note_date = coalesce((p_data->>'credit_note_date')::date, public.ist_today()),
      reason = trim(p_data->>'reason'),
      place_of_supply = inv.place_of_supply,
      supply_type = inv.supply_type,
      gst_applicable = inv.gst_applicable,
      discount_type = coalesce(p_data->>'discount_type', 'amount'),
      discount_value = coalesce((p_data->>'discount_value')::numeric, 0),
      notes = coalesce(p_data->>'notes', '')
  where id = cid;

  delete from public.credit_note_items where credit_note_id = cid;
  insert into public.credit_note_items
    (organization_id, credit_note_id, position, description, sac_code, quantity, unit_price,
     discount_type, discount_value, tax_rate)
  select org, cid, ord::int, item->>'description', coalesce(item->>'sac_code', ''),
         (item->>'quantity')::numeric, (item->>'unit_price')::numeric,
         coalesce(item->>'discount_type', 'amount'), coalesce((item->>'discount_value')::numeric, 0),
         -- Same tax treatment as the invoice: none without GST, zero-rated exports.
         case when inv.gst_applicable and inv.supply_type <> 'export' then coalesce((item->>'tax_rate')::numeric, 0) else 0 end
  from jsonb_array_elements(p_data->'items') with ordinality as x(item, ord);

  perform public.recalculate_document('credit_note', cid);
  return cid;
end;
$$;

-- ───────────────────────── Issue / cancel ─────────────────────────

create function public.credit_note_action(p_id uuid, p_action text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  org uuid := public.current_org_id();
  cn public.credit_notes;
  inv public.invoices;
  fy_end date;
  excess numeric;
  alloc record;
  take numeric;
begin
  select * into cn from public.credit_notes where id = p_id and organization_id = org for update;
  if cn.id is null then
    raise exception 'Credit note not found' using errcode = '22023';
  end if;

  case p_action
  when 'issue' then
    if not public.has_permission('credit_notes.create') then raise exception 'permission denied' using errcode = '42501'; end if;
    if cn.status <> 'draft' then raise exception 'Only drafts can be issued' using errcode = '22023'; end if;
    select * into inv from public.invoices where id = cn.invoice_id for update;
    perform 1 from public.clients where id = inv.client_id for update;
    if inv.status <> 'issued' then
      raise exception 'The invoice is no longer issued' using errcode = '22023';
    end if;
    if cn.credit_note_date < inv.invoice_date then
      raise exception 'The credit note date cannot be before the invoice date' using errcode = '22023';
    end if;
    -- Section 34(2): GST credit notes by 30 November after the end of the invoice's financial year.
    fy_end := make_date(extract(year from inv.invoice_date)::int + case when extract(month from inv.invoice_date) >= 4 then 1 else 0 end, 3, 31);
    if inv.gst_applicable and cn.credit_note_date > make_date(extract(year from fy_end)::int, 11, 30) then
      raise exception 'GST credit notes for this invoice had to be issued by 30-11-%', extract(year from fy_end)::int
        using errcode = '22023';
    end if;
    if cn.grand_total + public.amount_credited(inv) > inv.grand_total then
      raise exception 'Credit notes cannot add up to more than the invoice total (₹% left to credit)',
        inv.grand_total - public.amount_credited(inv) using errcode = '22023';
    end if;

    update public.credit_notes
    set status = 'issued', issued_at = now(), issued_by = auth.uid(),
        number = public.next_document_number('credit_note', cn.credit_note_date),
        billing_name = inv.billing_name, billing_address = inv.billing_address, billing_gstin = inv.billing_gstin
    where id = p_id;

    -- Paid more than the invoice is now worth: release the excess (latest payments first) back to client credit.
    excess := public.amount_paid(inv) + public.amount_credited(inv) - inv.grand_total;
    for alloc in
      select a.id, a.amount from public.payment_allocations a join public.payments p on p.id = a.payment_id
      where a.invoice_id = inv.id and p.status = 'confirmed'
      order by p.payment_date desc, p.created_at desc
    loop
      exit when excess <= 0;
      take := least(alloc.amount, excess);
      if take = alloc.amount then
        delete from public.payment_allocations where id = alloc.id;
      else
        update public.payment_allocations set amount = amount - take where id = alloc.id;
      end if;
      excess := excess - take;
    end loop;

  when 'cancel' then
    if not public.has_permission('credit_notes.cancel') then raise exception 'permission denied' using errcode = '42501'; end if;
    if cn.status <> 'issued' then raise exception 'Only issued credit notes can be cancelled' using errcode = '22023'; end if;
    -- The invoice balance goes back up; credit already released or refunded stays where it is.
    update public.credit_notes set status = 'cancelled' where id = p_id;

  else
    raise exception 'Unknown action %', p_action using errcode = '22023';
  end case;
  return p_id;
end;
$$;

-- Invoices with issued credit notes cannot be cancelled (§16): cancel the credit notes first.
create or replace function public.invoice_action(p_id uuid, p_action text, p_reason text default null) returns uuid
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
    if exists (select 1 from public.credit_notes where invoice_id = p_id and status = 'issued') then
      raise exception 'This invoice has credit notes. Cancel them before cancelling the invoice.' using errcode = '22023';
    end if;
    if exists (select 1 from public.payment_allocations a join public.payments p on p.id = a.payment_id
               where a.invoice_id = p_id and p.status = 'confirmed') then
      raise exception 'This invoice has payments. Remove them from the invoice (they return to client credit) before cancelling.'
        using errcode = '22023';
    end if;
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

revoke execute on function public.save_credit_note, public.credit_note_action from public, anon;
grant execute on function public.save_credit_note, public.credit_note_action to authenticated;
