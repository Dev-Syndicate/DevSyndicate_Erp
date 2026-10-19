-- Leads hand-off (PRD §47): whoever adds a lead picks its owner (the person who will call), and keeps read access
-- to leads they added. Only the owner (or leads.view_all) edits, logs activity, converts or deletes.
-- Owners must be active users who can hold leads (lead_owners), so a lead is never handed to someone who can't see it.

drop policy "leads.view reads own, view_all reads all" on public.leads;
create policy "leads.view reads own and added, view_all reads all" on public.leads for select to authenticated
  using (organization_id = (select public.current_org_id())
         and ((select public.has_permission('leads.view_all'))
              or ((select public.has_permission('leads.view'))
                  and (owner_id = (select auth.uid()) or created_by = (select auth.uid())))));

drop policy "leads.create adds leads" on public.leads;
create policy "leads.create adds leads for any lead holder" on public.leads for insert to authenticated
  with check (organization_id = (select public.current_org_id()) and (select public.has_permission('leads.create'))
              and status <> 'won' and client_id is null and created_by = (select auth.uid())
              and owner_id in (select o.id from public.lead_owners() o));

drop policy "leads.update edits open leads" on public.leads;
create policy "leads.update edits open leads" on public.leads for update to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('leads.update')) and status <> 'won'
         and ((select public.has_permission('leads.view_all')) or owner_id = (select auth.uid())))
  with check (organization_id = (select public.current_org_id()) and status <> 'won' and client_id is null
              and ((select public.has_permission('leads.view_all')) or owner_id = (select auth.uid()))
              and owner_id in (select o.id from public.lead_owners() o));

-- Activities: only the owner (or view_all) logs them; the person who added the lead can read them.
drop policy "leads.update logs activities" on public.lead_activities;
create policy "lead owner logs activities" on public.lead_activities for insert to authenticated
  with check (organization_id = (select public.current_org_id()) and (select public.has_permission('leads.update'))
              and created_by = (select auth.uid())
              and exists (select 1 from public.leads l where l.id = lead_id
                          and ((select public.has_permission('leads.view_all')) or l.owner_id = (select auth.uid()))));
