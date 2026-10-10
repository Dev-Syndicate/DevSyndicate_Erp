-- Quotation → invoice: add 'amount' mode (bill a specific amount, e.g. an advance).
-- New argument p_amount, so the function is dropped and recreated (an overload would confuse PostgREST).

drop function public.convert_quotation(uuid, text, numeric, jsonb);

-- ───────────────────────── Quotation → invoice (PRD §14) ─────────────────────────
-- p_mode: 'full'    copy every line as quoted
--         'percent' one line per quotation line at p_percent of its value ("50% advance — …")
--         'items'   p_items = [{ id, quantity }]: chosen lines and quantities
--         'amount'  p_amount as one line before GST ("Part payment — <title>"); needs one tax rate across lines
-- Partial modes fold each line's share of the document discount into the line, so taxable values match the quotation.

create function public.convert_quotation(
  p_id uuid, p_mode text, p_percent numeric default null, p_items jsonb default null, p_amount numeric default null
)
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
  elsif p_mode = 'amount' then
    if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
      raise exception 'Enter an amount above 0 with up to 2 decimals' using errcode = '22023';
    end if;
    if (select count(distinct tax_rate) from public.quotation_items where quotation_id = p_id) > 1 then
      raise exception 'The quotation lines have different tax rates. Bill by percentage or selected lines instead.' using errcode = '22023';
    end if;
    select jsonb_build_array(jsonb_build_object(
             'description', 'Part payment — ' || q.title, 'sac_code', min(sac_code), 'quantity', 1, 'unit_price', p_amount,
             'discount_type', 'amount', 'discount_value', 0, 'tax_rate', max(tax_rate)))
    into items from public.quotation_items where quotation_id = p_id;
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

revoke execute on function public.convert_quotation from public, anon;
grant execute on function public.convert_quotation to authenticated;
