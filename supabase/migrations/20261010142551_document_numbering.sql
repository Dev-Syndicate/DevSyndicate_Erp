-- Custom document numbering (PRD §30): pattern, padding, reset period, gapless counters.
-- Replaces the fixed prefix_* columns on company_settings.

create table public.document_numbering (
  organization_id uuid not null references public.organizations(id),
  doc_type text not null check (doc_type in ('quotation', 'invoice', 'credit_note', 'receipt', 'expense')),
  -- Literal A-Z 0-9 / - _ . plus tokens {FY} {YYYY} {YY} {MM} {SEQ}.
  pattern text not null check (length(pattern) <= 30 and pattern ~ '^([A-Z0-9/_.-]|\{(FY|YYYY|YY|MM|SEQ)\})+$'),
  padding int not null default 4 check (padding between 1 and 8),
  reset text not null default 'financial_year' check (reset in ('financial_year', 'calendar_year', 'never')),
  updated_at timestamptz not null default now(),
  primary key (organization_id, doc_type),
  -- Exactly one counter.
  check (length(pattern) - length(replace(pattern, '{SEQ}', '')) = 5),
  -- A yearly reset needs the year in the number, otherwise numbers repeat.
  check (reset <> 'financial_year' or pattern like '%{FY}%'),
  check (reset <> 'calendar_year' or pattern like '%{YYYY}%' or pattern like '%{YY}%'),
  -- GST: invoice and credit note numbers max 16 characters (at full padding).
  check (doc_type not in ('invoice', 'credit_note') or length(
    replace(replace(replace(replace(replace(pattern, '{FY}', '00-00'), '{YYYY}', '0000'), '{YY}', '00'), '{MM}', '00'),
            '{SEQ}', repeat('0', padding))) <= 16)
);

create table public.document_sequences (
  organization_id uuid not null references public.organizations(id),
  doc_type text not null,
  period_key text not null,             -- '2026-27', '2026' or 'all'
  last_value bigint not null default 0 check (last_value >= 0),
  primary key (organization_id, doc_type, period_key),
  foreign key (organization_id, doc_type) references public.document_numbering (organization_id, doc_type)
);

-- Financial year starts in April; dates are IST business dates (PRD §8).
create function public.document_period_key(p_reset text, p_date date) returns text
language sql immutable set search_path = '' as $$
  select case p_reset
    when 'financial_year' then fy::text || '-' || lpad(((fy + 1) % 100)::text, 2, '0')
    when 'calendar_year' then extract(year from p_date)::int::text
    else 'all'
  end
  from (select case when extract(month from p_date) >= 4 then extract(year from p_date)::int
                    else extract(year from p_date)::int - 1 end as fy) y;
$$;

create function public.render_document_number(p_pattern text, p_padding int, p_seq bigint, p_date date) returns text
language sql immutable set search_path = '' as $$
  select replace(replace(replace(replace(replace(p_pattern,
    '{FY}', lpad((fy % 100)::text, 2, '0') || '-' || lpad(((fy + 1) % 100)::text, 2, '0')),
    '{YYYY}', to_char(p_date, 'YYYY')),
    '{YY}', to_char(p_date, 'YY')),
    '{MM}', to_char(p_date, 'MM')),
    '{SEQ}', lpad(p_seq::text, greatest(p_padding, length(p_seq::text)), '0'))
  from (select case when extract(month from p_date) >= 4 then extract(year from p_date)::int
                    else extract(year from p_date)::int - 1 end as fy) y;
$$;

create function public.ist_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Kolkata')::date;
$$;

-- Issues the next number. The upsert row-locks the counter, so concurrent callers queue up, and a
-- rolled-back transaction rolls the counter back too: numbers stay gapless and unique.
-- Only called from issue functions (security definer) that check permissions; not exposed to clients.
create function public.next_document_number(p_doc_type text, p_date date default public.ist_today()) returns text
language plpgsql security definer set search_path = '' as $$
declare
  org uuid := public.current_org_id();
  cfg public.document_numbering;
  seq bigint;
begin
  select * into strict cfg from public.document_numbering where organization_id = org and doc_type = p_doc_type;
  insert into public.document_sequences (organization_id, doc_type, period_key, last_value)
  values (org, p_doc_type, public.document_period_key(cfg.reset, p_date), 1)
  on conflict (organization_id, doc_type, period_key)
    do update set last_value = public.document_sequences.last_value + 1
  returning last_value into seq;
  return public.render_document_number(cfg.pattern, cfg.padding, seq, p_date);
end;
$$;

-- Numbering settings with the next counter value for the current period. Invoker: RLS applies.
create function public.document_numbering_settings()
returns table (doc_type text, pattern text, padding int, reset text, next_value bigint)
language sql stable set search_path = '' as $$
  select n.doc_type, n.pattern, n.padding, n.reset, coalesce(s.last_value, 0) + 1
  from public.document_numbering n
  left join public.document_sequences s
    on s.organization_id = n.organization_id and s.doc_type = n.doc_type
   and s.period_key = public.document_period_key(n.reset, public.ist_today())
  where n.organization_id = public.current_org_id();
$$;

-- Saves one document type's format and the next number for the current period (settings.update).
create function public.set_document_numbering(
  p_doc_type text, p_pattern text, p_padding int, p_reset text, p_next_value bigint
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  org uuid := public.current_org_id();
begin
  if org is null or not public.has_permission('settings.update') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_next_value < 1 then
    raise exception 'next number must be at least 1' using errcode = '22023';
  end if;

  update public.document_numbering
  set pattern = p_pattern, padding = p_padding, reset = p_reset
  where organization_id = org and doc_type = p_doc_type;
  if not found then
    raise exception 'unknown document type %', p_doc_type using errcode = '22023';
  end if;

  -- shortcut: lowering the next number is allowed while no documents exist; once issuing ships,
  -- the unique document number constraint rejects any duplicate it would cause.
  insert into public.document_sequences (organization_id, doc_type, period_key, last_value)
  values (org, p_doc_type, public.document_period_key(p_reset, public.ist_today()), p_next_value - 1)
  on conflict (organization_id, doc_type, period_key) do update set last_value = excluded.last_value;
end;
$$;

revoke execute on function public.next_document_number from public, anon, authenticated;
revoke execute on function public.set_document_numbering, public.document_numbering_settings from public, anon;
grant execute on function public.set_document_numbering, public.document_numbering_settings to authenticated;

create trigger set_updated_at before update on public.document_numbering for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.document_numbering for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.document_sequences for each row execute function public.audit_row_change();

alter table public.document_numbering enable row level security;
alter table public.document_sequences enable row level security;

create policy "members read numbering" on public.document_numbering for select to authenticated
  using (organization_id = (select public.current_org_id()));
create policy "members read sequences" on public.document_sequences for select to authenticated
  using (organization_id = (select public.current_org_id()));
-- Writes only through set_document_numbering / next_document_number.

revoke all on public.document_numbering, public.document_sequences from anon;

-- Seed from the old prefixes, then drop them.
insert into public.document_numbering (organization_id, doc_type, pattern)
select cs.organization_id, t.doc_type, t.prefix || '/{FY}/{SEQ}'
from public.company_settings cs,
  lateral (values ('quotation', cs.prefix_quotation), ('invoice', cs.prefix_invoice),
                  ('credit_note', cs.prefix_credit_note), ('receipt', cs.prefix_receipt),
                  ('expense', cs.prefix_expense)) as t(doc_type, prefix);

alter table public.company_settings
  drop column prefix_quotation cascade,
  drop column prefix_invoice cascade,
  drop column prefix_credit_note cascade,
  drop column prefix_receipt cascade,
  drop column prefix_expense cascade;
