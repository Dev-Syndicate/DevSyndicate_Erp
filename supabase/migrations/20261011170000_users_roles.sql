-- Users & roles (PRD §4–§6, §32.4; v1.4). Invites create the auth user with the service role (server-only, §32.3);
-- every decision (who may invite whom, which role) is checked here, with the inviter's session.

-- ───────────────────────── Users list ─────────────────────────
-- Profiles plus sign-in facts from auth.users. Admins don't see Super Admins (§4.2).

create function public.list_users()
returns table (id uuid, full_name text, email text, role_id uuid, role_name text, role_key text, is_active boolean,
               invited_at timestamptz, last_sign_in_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.email, p.role_id, r.name, r.key, p.is_active, u.invited_at, u.last_sign_in_at, p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.roles r on r.id = p.role_id
  where p.organization_id = public.current_org_id()
    and public.has_permission('users.view')
    and (coalesce(r.key, '') <> 'super_admin' or public.is_super_admin(auth.uid()))
  order by p.is_active desc, p.full_name, p.email;
$$;

-- ───────────────────────── Invite ─────────────────────────

-- Before the auth user exists: may the caller invite this email with this role?
create function public.check_invite(p_email text, p_role_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  org uuid := public.current_org_id();
  rk text;
begin
  if org is null or not public.has_permission('users.create') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select key into rk from public.roles where id = p_role_id and organization_id = org;
  if rk is null then
    raise exception 'Choose a role' using errcode = '22023';
  end if;
  if rk = 'super_admin' and not public.is_super_admin(auth.uid()) then
    raise exception 'Only a Super Admin can invite a Super Admin' using errcode = '42501';
  end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email' using errcode = '22023';
  end if;
  if exists (select 1 from auth.users where lower(email) = lower(trim(p_email))) then
    raise exception 'This email already has an account. Find it in the list to change its role or send a new link.' using errcode = '22023';
  end if;
end;
$$;

-- After the auth user exists (no role, inactive): give it the role and the name.
create function public.activate_invited_user(p_id uuid, p_role_id uuid, p_full_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  org uuid := public.current_org_id();
  rk text;
begin
  if org is null or not public.has_permission('users.create') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select key into rk from public.roles where id = p_role_id and organization_id = org;
  if rk is null or (rk = 'super_admin' and not public.is_super_admin(auth.uid())) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  -- Only a brand-new invitee: never signed in, no role yet.
  update public.profiles p
  set role_id = p_role_id, full_name = trim(coalesce(p_full_name, '')), is_active = true
  from auth.users u
  where p.id = p_id and u.id = p.id and p.organization_id = org and p.role_id is null and u.last_sign_in_at is null;
  if not found then
    raise exception 'Invite not found' using errcode = '22023';
  end if;
end;
$$;

-- ───────────────────────── Change role / active ─────────────────────────
-- guard_profile_update (foundation) still applies: Super Admin rules, no changes to yourself, one active Super Admin.

create function public.update_user(p_id uuid, p_role_id uuid, p_is_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  org uuid := public.current_org_id();
  cur public.profiles;
begin
  select * into cur from public.profiles where id = p_id and organization_id = org;
  if org is null or cur.id is null then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_role_id is distinct from cur.role_id and not public.has_permission('users.update') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_is_active is distinct from cur.is_active and not public.has_permission('users.deactivate') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if not exists (select 1 from public.roles where id = p_role_id and organization_id = org) then
    raise exception 'Choose a role' using errcode = '22023';
  end if;
  update public.profiles set role_id = p_role_id, is_active = p_is_active where id = p_id;
end;
$$;

-- For a new invite / password link: the user must be visible to the caller and not a Super Admin unless the caller is one.
create function public.check_user_link(p_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  org uuid := public.current_org_id();
  e text;
  rk text;
begin
  if org is null or not public.has_permission('users.update') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select p.email, r.key into e, rk from public.profiles p left join public.roles r on r.id = p.role_id
  where p.id = p_id and p.organization_id = org and p.is_active;
  if e is null then
    raise exception 'Only active users can get a link' using errcode = '22023';
  end if;
  if rk = 'super_admin' and not public.is_super_admin(auth.uid()) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return e;
end;
$$;

-- ───────────────────────── Roles ─────────────────────────

-- The Super Admin role always has every permission (§4.1): its grants can't be changed from the app.
create function public.guard_super_admin_permissions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null
     and exists (select 1 from public.roles where id = coalesce(new.role_id, old.role_id) and key = 'super_admin') then
    raise exception 'The Super Admin role always has every permission' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger guard_super_admin_permissions before insert or delete on public.role_permissions
for each row execute function public.guard_super_admin_permissions();

-- New custom role: key from the name.
create function public.create_role(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  org uuid := public.current_org_id();
  k text := trim(both '_' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '_', 'g'));
  rid uuid;
begin
  if org is null or not public.has_permission('roles.manage') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 or k = '' then
    raise exception 'Enter a role name' using errcode = '22023';
  end if;
  if exists (select 1 from public.roles where organization_id = org and (key = k or lower(name) = lower(trim(p_name)))) then
    raise exception 'A role with this name already exists' using errcode = '22023';
  end if;
  insert into public.roles (organization_id, key, name) values (org, k, trim(p_name)) returning id into rid;
  return rid;
end;
$$;

revoke execute on function public.list_users, public.check_invite, public.activate_invited_user, public.update_user,
  public.check_user_link, public.create_role from public, anon;
grant execute on function public.list_users, public.check_invite, public.activate_invited_user, public.update_user,
  public.check_user_link, public.create_role to authenticated;
revoke execute on function public.guard_super_admin_permissions from public, anon, authenticated;
