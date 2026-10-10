-- Configuration: company settings, tax rates, expense categories (PRD §15, §22, §29).

create table public.company_settings (
  organization_id uuid primary key references public.organizations(id),
  -- Company
  legal_name text not null default '',
  trade_name text not null default '',
  address text not null default '',
  city text not null default '',
  state text not null default '',
  pin_code text not null default '' check (pin_code = '' or pin_code ~ '^[1-9][0-9]{5}$'),
  country text not null default 'India',
  email text not null default '',
  phone text not null default '',
  website text not null default '',
  pan text not null default '' check (pan = '' or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  -- Tax
  gst_registered boolean not null default false,
  gstin text not null default '' check (gstin = '' or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  default_sac_code text not null default '998314',
  lut_number text not null default '',
  lut_valid_until date,
  -- Banking
  bank_name text not null default '',
  bank_account_name text not null default '',
  bank_account_number text not null default '',
  bank_ifsc text not null default '' check (bank_ifsc = '' or bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  upi_id text not null default '',
  -- Documents
  prefix_quotation text not null default 'QTN',
  prefix_invoice text not null default 'INV',
  prefix_credit_note text not null default 'CN',
  prefix_receipt text not null default 'TXN',
  prefix_expense text not null default 'EXP',
  quotation_validity_days int not null default 15 check (quotation_validity_days between 1 and 365),
  payment_terms_days int not null default 15 check (payment_terms_days between 0 and 365),
  quotation_terms text not null default '',
  invoice_terms text not null default '',
  round_off boolean not null default true,
  signatory_name text not null default '',
  updated_at timestamptz not null default now(),
  -- GST registration needs a GSTIN (PRD §15).
  check (not gst_registered or gstin <> ''),
  -- Invoice numbers must fit in 16 chars: prefix + '/26-27/' + 4+ digits (PRD §30).
  check (length(prefix_invoice) between 1 and 5 and length(prefix_credit_note) between 1 and 5)
);

create table public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null check (length(trim(name)) > 0),
  rate numeric(5,2) not null check (rate >= 0 and rate <= 100),
  is_active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null check (length(trim(name)) > 0),
  is_active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

alter table public.company_settings add column default_tax_rate_id uuid references public.tax_rates(id);

create index on public.company_settings (default_tax_rate_id);
create index on public.tax_rates (organization_id);
create index on public.expense_categories (organization_id);

create trigger set_updated_at before update on public.company_settings for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tax_rates for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.expense_categories for each row execute function public.set_updated_at();

create trigger audit after insert or update or delete on public.company_settings for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.tax_rates for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.expense_categories for each row execute function public.audit_row_change();

-- company_settings has no id column; use the organization id as the audited record id.
create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  row_data jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_logs (organization_id, actor_id, action, table_name, record_id, before, after)
  values (
    coalesce((row_data->>'organization_id')::uuid,
             case when tg_table_name = 'organizations' then (row_data->>'id')::uuid end,
             (select organization_id from public.roles where id = (row_data->>'role_id')::uuid),
             public.current_org_id()),
    auth.uid(),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    coalesce(row_data->>'id',
             (row_data->>'role_id') || ':' || (row_data->>'permission'),
             row_data->>'organization_id'),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;
revoke execute on function public.audit_row_change from public, anon, authenticated;

alter table public.company_settings enable row level security;
alter table public.tax_rates enable row level security;
alter table public.expense_categories enable row level security;

-- Every active member reads settings: quotations/invoices/expenses need company, tax and category data.
create policy "members read company settings" on public.company_settings for select to authenticated
  using (organization_id = (select public.current_org_id()));
create policy "settings.update edits company settings" on public.company_settings for update to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('settings.update')))
  with check (organization_id = (select public.current_org_id()));

create policy "members read tax rates" on public.tax_rates for select to authenticated
  using (organization_id = (select public.current_org_id()));
create policy "settings.update adds tax rates" on public.tax_rates for insert to authenticated
  with check (organization_id = (select public.current_org_id()) and (select public.has_permission('settings.update')));
create policy "settings.update edits tax rates" on public.tax_rates for update to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('settings.update')))
  with check (organization_id = (select public.current_org_id()));

create policy "members read expense categories" on public.expense_categories for select to authenticated
  using (organization_id = (select public.current_org_id()));
create policy "settings.update adds expense categories" on public.expense_categories for insert to authenticated
  with check (organization_id = (select public.current_org_id()) and (select public.has_permission('settings.update')));
create policy "settings.update edits expense categories" on public.expense_categories for update to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('settings.update')))
  with check (organization_id = (select public.current_org_id()));
-- No delete policies: archive with is_active = false so past documents keep their references (PRD §22).

revoke all on public.company_settings, public.tax_rates, public.expense_categories from anon;

-- Seed
insert into public.company_settings (organization_id, legal_name, trade_name)
select id, name, name from public.organizations;

insert into public.tax_rates (organization_id, name, rate)
select o.id, t.name, t.rate from public.organizations o,
  (values ('GST 0%', 0), ('GST 5%', 5), ('GST 18%', 18)) as t(name, rate);

update public.company_settings cs set default_tax_rate_id = t.id
from public.tax_rates t where t.organization_id = cs.organization_id and t.name = 'GST 18%';

insert into public.expense_categories (organization_id, name)
select o.id, c.name from public.organizations o,
  unnest(array['Hosting', 'Domain', 'Software', 'Marketing', 'Equipment', 'Office', 'Travel', 'Salary',
               'Professional Services', 'Taxes', 'Other']) as c(name);
