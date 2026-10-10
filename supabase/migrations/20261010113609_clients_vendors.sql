-- Clients, client contacts, vendors (PRD §23, §24).

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  company_name text not null check (length(trim(company_name)) > 0),
  billing_address text not null default '',
  city text not null default '',
  state text not null default '',
  country text not null default 'India',
  pin_code text not null default '',
  gstin text not null default '' check (gstin = '' or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  pan text not null default '' check (pan = '' or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  payment_terms_days int check (payment_terms_days between 0 and 365),  -- null = company default
  notes text not null default '',
  deleted_at timestamptz,                                               -- archived (PRD §8)
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (country <> 'India' or pin_code = '' or pin_code ~ '^[1-9][0-9]{5}$')
);

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  client_id uuid not null references public.clients(id),
  name text not null check (length(trim(name)) > 0),
  designation text not null default '',
  email text not null default '',
  phone text not null default '',
  is_primary boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null check (length(trim(name)) > 0),
  contact_person text not null default '',
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  gstin text not null default '' check (gstin = '' or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  default_expense_category_id uuid references public.expense_categories(id),
  notes text not null default '',
  deleted_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.clients (organization_id, company_name);
create index on public.client_contacts (client_id);
create index on public.client_contacts (organization_id);
create unique index client_contacts_one_primary on public.client_contacts (client_id) where is_primary;
create index on public.vendors (organization_id, name);
create index on public.vendors (default_expense_category_id);

-- A contact belongs to a client of the same organization.
create function public.check_contact_client() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.clients where id = new.client_id and organization_id = new.organization_id) then
    raise exception 'client not found in this organization';
  end if;
  return new;
end;
$$;

-- Archiving/restoring needs <module>.delete; editing other fields needs <module>.update (PRD §5).
-- tg_argv[0] = delete permission, tg_argv[1] = update permission.
create function public.guard_archive() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.deleted_at is distinct from old.deleted_at and not public.has_permission(tg_argv[0]) then
    raise exception 'missing permission %', tg_argv[0];
  end if;
  if (to_jsonb(new) - 'deleted_at' - 'updated_at') <> (to_jsonb(old) - 'deleted_at' - 'updated_at')
     and not public.has_permission(tg_argv[1]) then
    raise exception 'missing permission %', tg_argv[1];
  end if;
  return new;
end;
$$;

revoke execute on function public.check_contact_client, public.guard_archive from public, anon, authenticated;

create trigger check_contact_client before insert or update on public.client_contacts for each row execute function public.check_contact_client();
create trigger guard_archive before update on public.clients for each row execute function public.guard_archive('clients.delete', 'clients.update');
create trigger guard_archive before update on public.vendors for each row execute function public.guard_archive('vendors.delete', 'vendors.update');

create trigger set_updated_at before update on public.clients for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.client_contacts for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.vendors for each row execute function public.set_updated_at();

create trigger audit after insert or update or delete on public.clients for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.client_contacts for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.vendors for each row execute function public.audit_row_change();

alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;
alter table public.vendors enable row level security;

create policy "clients.view reads clients" on public.clients for select to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('clients.view')));
create policy "clients.create adds clients" on public.clients for insert to authenticated
  with check (organization_id = (select public.current_org_id()) and (select public.has_permission('clients.create')));
create policy "clients.update edits clients" on public.clients for update to authenticated
  using (organization_id = (select public.current_org_id())
         and ((select public.has_permission('clients.update')) or (select public.has_permission('clients.delete'))))
  with check (organization_id = (select public.current_org_id()));

create policy "clients.view reads contacts" on public.client_contacts for select to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('clients.view')));
create policy "clients.update adds contacts" on public.client_contacts for insert to authenticated
  with check (organization_id = (select public.current_org_id())
              and ((select public.has_permission('clients.update')) or (select public.has_permission('clients.create'))));
create policy "clients.update edits contacts" on public.client_contacts for update to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('clients.update')))
  with check (organization_id = (select public.current_org_id()));
create policy "clients.update removes contacts" on public.client_contacts for delete to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('clients.update')));

create policy "vendors.view reads vendors" on public.vendors for select to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('vendors.view')));
create policy "vendors.create adds vendors" on public.vendors for insert to authenticated
  with check (organization_id = (select public.current_org_id()) and (select public.has_permission('vendors.create')));
create policy "vendors.update edits vendors" on public.vendors for update to authenticated
  using (organization_id = (select public.current_org_id())
         and ((select public.has_permission('vendors.update')) or (select public.has_permission('vendors.delete'))))
  with check (organization_id = (select public.current_org_id()));
-- No delete policies on clients/vendors: they are archived (deleted_at), never removed.

revoke all on public.clients, public.client_contacts, public.vendors from anon;
