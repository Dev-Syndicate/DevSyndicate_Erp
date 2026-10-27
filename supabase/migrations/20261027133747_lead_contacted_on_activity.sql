-- Logging a call, meeting, email or message on a New lead moves it to Contacted (PRD §47). A note doesn't: nobody
-- was contacted. In the database so the app and the Claude connector behave the same.

create function public.lead_contacted_on_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind <> 'note' then
    update public.leads set status = 'contacted' where id = new.lead_id and status = 'new';
  end if;
  return new;
end;
$$;

revoke execute on function public.lead_contacted_on_activity from public, anon, authenticated;

create trigger lead_contacted after insert on public.lead_activities
for each row execute function public.lead_contacted_on_activity();

-- Leads already contacted before this rule.
update public.leads l set status = 'contacted'
where l.status = 'new' and exists (select 1 from public.lead_activities a where a.lead_id = l.id and a.kind <> 'note');
