-- Foundation: organizations, profiles, roles & permissions, audit logs, RLS (PRD §4, §5, §28, §32).

-- ───────────────────────── Tables ─────────────────────────

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.permissions (
  key text primary key,            -- e.g. 'invoices.view'
  description text not null default ''
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  key text not null,               -- 'super_admin' is special (PRD §32.4)
  name text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission text not null references public.permissions(key) on delete cascade,
  primary key (role_id, permission)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  role_id uuid references public.roles(id),
  full_name text not null default '',
  email text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id),
  actor_id uuid,                   -- null = system / SQL console
  action text not null,            -- '<table>.<insert|update|delete>' or app event
  table_name text,
  record_id text,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index on public.roles (organization_id);
create index on public.role_permissions (permission);
create index on public.profiles (organization_id);
create index on public.profiles (role_id);
create index on public.audit_logs (organization_id, created_at desc);

-- ───────────────────────── Helpers ─────────────────────────

create function public.current_org_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select organization_id from public.profiles
  where id = (select auth.uid()) and is_active;
$$;

create function public.has_permission(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles pr
    join public.role_permissions rp on rp.role_id = pr.role_id
    where pr.id = (select auth.uid()) and pr.is_active and rp.permission = p
  );
$$;

create function public.is_super_admin(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles pr
    join public.roles r on r.id = pr.role_id
    where pr.id = uid and pr.is_active and r.key = 'super_admin'
  );
$$;

-- Permissions of the signed-in user, for UI (nav filtering). RLS stays the real guard.
create function public.my_permissions() returns setof text
language sql stable security definer set search_path = '' as $$
  select rp.permission from public.profiles pr
  join public.role_permissions rp on rp.role_id = pr.role_id
  where pr.id = (select auth.uid()) and pr.is_active;
$$;

revoke execute on function public.current_org_id, public.has_permission, public.is_super_admin, public.my_permissions from public, anon;
grant execute on function public.current_org_id, public.has_permission, public.is_super_admin, public.my_permissions to authenticated;

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.roles for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

-- ───────────────────────── Audit (PRD §28) ─────────────────────────

create function public.audit_row_change() returns trigger
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
    coalesce(row_data->>'id', (row_data->>'role_id') || ':' || (row_data->>'permission')),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create trigger audit after insert or update or delete on public.organizations for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.roles for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.role_permissions for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.profiles for each row execute function public.audit_row_change();

-- ───────────────────────── Super Admin protection (PRD §32.4) ─────────────────────────

create function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  sa_role uuid;
begin
  if new.id <> old.id or new.organization_id <> old.organization_id then
    raise exception 'profile id and organization cannot change';
  end if;

  select id into sa_role from public.roles where organization_id = old.organization_id and key = 'super_admin';

  -- actor is null for server-side admin / SQL console; RLS already blocks anonymous clients.
  if actor is not null then
    if (old.role_id = sa_role or new.role_id = sa_role) and not public.is_super_admin(actor) then
      raise exception 'only a Super Admin can modify a Super Admin or assign the role';
    end if;
    if actor = old.id and (new.role_id is distinct from old.role_id or new.is_active <> old.is_active) then
      raise exception 'you cannot change your own role or active status';
    end if;
  end if;

  if old.role_id = sa_role and old.is_active
     and (new.role_id is distinct from sa_role or not new.is_active)
     and not exists (select 1 from public.profiles
                     where role_id = sa_role and is_active and id <> old.id) then
    raise exception 'at least one active Super Admin must remain';
  end if;

  return new;
end;
$$;

create trigger guard_profile_update before update on public.profiles for each row execute function public.guard_profile_update();

create function public.guard_role_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' and old.is_system then
    raise exception 'system roles cannot be deleted';
  end if;
  if tg_op = 'UPDATE' and old.is_system and new.key <> old.key then
    raise exception 'system role keys cannot change';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger guard_role_change before update or delete on public.roles for each row execute function public.guard_role_change();

-- ───────────────────────── New auth user → profile ─────────────────────────
-- Invite-only (PRD §6): access requires app_metadata.role_id, which only the service role can set.
-- Anyone who signs up without it gets an inactive profile with no role, i.e. no access.

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  org uuid;
  r uuid;
begin
  select id into org from public.organizations order by created_at limit 1;
  select id into r from public.roles
  where organization_id = org and id = nullif(new.raw_app_meta_data->>'role_id', '')::uuid;

  insert into public.profiles (id, organization_id, role_id, full_name, email, is_active)
  values (new.id, org, r, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email, r is not null);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ───────────────────────── RLS ─────────────────────────

alter table public.organizations enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.audit_logs enable row level security;

create policy "members read own org" on public.organizations for select to authenticated
  using (id = (select public.current_org_id()));
create policy "settings.update edits org" on public.organizations for update to authenticated
  using (id = (select public.current_org_id()) and (select public.has_permission('settings.update')));

create policy "authenticated read permission catalog" on public.permissions for select to authenticated
  using (true);

create policy "read roles" on public.roles for select to authenticated
  using (organization_id = (select public.current_org_id())
         and ((select public.has_permission('roles.view'))
              or id = (select role_id from public.profiles where id = (select auth.uid()))));
create policy "roles.manage inserts roles" on public.roles for insert to authenticated
  with check (organization_id = (select public.current_org_id()) and (select public.has_permission('roles.manage')));
create policy "roles.manage updates roles" on public.roles for update to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('roles.manage')));
create policy "roles.manage deletes roles" on public.roles for delete to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('roles.manage')));

create policy "read role permissions" on public.role_permissions for select to authenticated
  using (exists (select 1 from public.roles r where r.id = role_id and r.organization_id = (select public.current_org_id()))
         and ((select public.has_permission('roles.view'))
              or role_id = (select role_id from public.profiles where id = (select auth.uid()))));
create policy "roles.manage grants permissions" on public.role_permissions for insert to authenticated
  with check ((select public.has_permission('roles.manage'))
              and exists (select 1 from public.roles r where r.id = role_id and r.organization_id = (select public.current_org_id())));
create policy "roles.manage revokes permissions" on public.role_permissions for delete to authenticated
  using ((select public.has_permission('roles.manage'))
         and exists (select 1 from public.roles r where r.id = role_id and r.organization_id = (select public.current_org_id())));

create policy "read own or users.view" on public.profiles for select to authenticated
  using (id = (select auth.uid())
         or (organization_id = (select public.current_org_id()) and (select public.has_permission('users.view'))));
create policy "users.update edits profiles" on public.profiles for update to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('users.update')))
  with check (organization_id = (select public.current_org_id()));
create policy "users edit own name" on public.profiles for update to authenticated
  using (id = (select auth.uid()) and is_active)
  with check (id = (select auth.uid()));
-- No insert (trigger only) and no delete (deactivate instead, PRD §4).

create policy "audit_logs.view reads log" on public.audit_logs for select to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('audit_logs.view')));
-- No insert/update/delete policies: append-only via security-definer trigger.

revoke all on all tables in schema public from anon;

-- ───────────────────────── Seed (PRD §5, §5.1) ─────────────────────────

insert into public.organizations (name) values ('DevSyndicate');

insert into public.permissions (key) values
  ('dashboard.view'),
  ('clients.view'), ('clients.create'), ('clients.update'), ('clients.delete'),
  ('vendors.view'), ('vendors.create'), ('vendors.update'), ('vendors.delete'),
  ('quotations.view'), ('quotations.create'), ('quotations.update'), ('quotations.delete'), ('quotations.send'), ('quotations.convert'),
  ('invoices.view'), ('invoices.create'), ('invoices.update'), ('invoices.delete'), ('invoices.issue'), ('invoices.cancel'),
  ('credit_notes.view'), ('credit_notes.create'), ('credit_notes.cancel'),
  ('payments.view'), ('payments.create'), ('payments.update'), ('payments.cancel'), ('payments.refund'),
  ('expenses.view'), ('expenses.create'), ('expenses.update'), ('expenses.delete'),
  ('documents.view'), ('documents.upload'), ('documents.delete'),
  ('reports.view'), ('reports.export'),
  ('data.import'),
  ('users.view'), ('users.create'), ('users.update'), ('users.deactivate'),
  ('roles.view'), ('roles.manage'),
  ('settings.view'), ('settings.update'),
  ('audit_logs.view');

insert into public.roles (organization_id, key, name, is_system)
select o.id, r.key, r.name, true
from public.organizations o,
  (values ('super_admin', 'Super Admin'), ('admin', 'Admin'), ('finance', 'Finance'), ('staff', 'Staff')) as r(key, name);

insert into public.role_permissions (role_id, permission)
select r.id, p.key from public.roles r join public.permissions p on
  case r.key
    when 'super_admin' then true
    when 'admin' then p.key not in ('roles.manage', 'settings.update', 'audit_logs.view')
    when 'finance' then split_part(p.key, '.', 1) in
      ('dashboard', 'clients', 'vendors', 'quotations', 'invoices', 'credit_notes', 'payments', 'expenses', 'documents', 'reports')
      or p.key = 'settings.view'
    when 'staff' then p.key in ('dashboard.view', 'clients.view', 'quotations.view', 'quotations.create')
  end;
