-- Backup status for the in-app indicator (PRD §34, v1.4). The nightly backup job inserts one row per organization
-- after each run (as the database owner, so no insert policy); members with settings.view read them.

create table public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  status text not null check (status in ('success', 'failure', 'cancelled')),
  finished_at timestamptz not null default now(),
  size_bytes bigint not null default 0,
  files int not null default 0,
  run_url text not null default ''
);

create index on public.backup_runs (organization_id, finished_at desc);
create trigger audit after insert or update or delete on public.backup_runs for each row execute function public.audit_row_change();

alter table public.backup_runs enable row level security;
create policy "settings.view reads backup runs" on public.backup_runs for select to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('settings.view')));

revoke all on public.backup_runs from anon;
