-- Monthly reset option for document numbering.

alter table public.document_numbering drop constraint document_numbering_reset_check;
alter table public.document_numbering add constraint document_numbering_reset_check
  check (reset in ('financial_year', 'calendar_year', 'monthly', 'never'));

-- A monthly reset needs the month and a year in the number, otherwise numbers repeat.
alter table public.document_numbering add constraint document_numbering_monthly_check
  check (reset <> 'monthly' or (pattern like '%{MM}%'
         and (pattern like '%{YYYY}%' or pattern like '%{YY}%' or pattern like '%{FY}%')));

create or replace function public.document_period_key(p_reset text, p_date date) returns text
language sql immutable set search_path = '' as $$
  select case p_reset
    when 'financial_year' then fy::text || '-' || lpad(((fy + 1) % 100)::text, 2, '0')
    when 'calendar_year' then extract(year from p_date)::int::text
    when 'monthly' then to_char(p_date, 'YYYY-MM')
    else 'all'
  end
  from (select case when extract(month from p_date) >= 4 then extract(year from p_date)::int
                    else extract(year from p_date)::int - 1 end as fy) y;
$$;
