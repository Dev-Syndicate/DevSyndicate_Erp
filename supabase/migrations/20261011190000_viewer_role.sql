-- Built-in Viewer role (PRD §4.5, §5.1): read-only access to the business modules Finance works in.
-- No create/update/delete/issue/export; no users, roles, audit log or Owner's Account (Super Admin can tick more).

insert into public.roles (organization_id, key, name, is_system)
select id, 'viewer', 'Viewer', true from public.organizations;

insert into public.role_permissions (role_id, permission)
select r.id, p.key from public.roles r, public.permissions p
where r.key = 'viewer'
  and p.key in ('dashboard.view', 'clients.view', 'vendors.view', 'quotations.view', 'invoices.view', 'credit_notes.view',
                'payments.view', 'expenses.view', 'documents.view', 'reports.view', 'settings.view');
