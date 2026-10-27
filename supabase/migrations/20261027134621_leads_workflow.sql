-- Leads workflow (PRD §47, v1.6): call outcomes and unanswered-attempt counts, a fixed lost-reason list with
-- Bad timing coming back on a date, and follow-up dates only where they mean something.

-- ───────────────────────── Call outcome ─────────────────────────
alter table public.lead_activities
  add column outcome text check (outcome in ('reached', 'no_answer', 'busy', 'wrong_number')),
  add constraint lead_activities_outcome_calls_only check (outcome is null or kind = 'call');

-- Calls logged before outcomes existed, tagged from what was written.
update public.lead_activities set outcome = case
    when body ~* '^\s*busy' then 'busy'
    when body ~* '^\s*(rnr|no answer|not answering|not reachable|switched off)' then 'no_answer'
    when body ~* '(invalid num|wrong num|other number|no incoming call)' then 'wrong_number'
    else 'reached' end
where kind = 'call';

alter table public.lead_activities add constraint lead_activities_call_outcome check (kind <> 'call' or outcome is not null);

-- Only real contact moves New to Contacted.
create or replace function public.lead_contacted_on_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind <> 'note' and (new.kind <> 'call' or new.outcome = 'reached') then
    update public.leads set status = 'contacted' where id = new.lead_id and status = 'new';
  end if;
  return new;
end;
$$;

-- Leads moved to Contacted earlier today by any call, though nobody was reached, go back to New.
update public.leads l set status = 'new'
where l.status = 'contacted'
  and not exists (select 1 from public.lead_activities a where a.lead_id = l.id
                  and a.kind <> 'note' and (a.kind <> 'call' or a.outcome = 'reached'));

-- Unanswered calls (no answer, busy) since the last reached call. PostgREST computed field.
create function public.call_attempts(public.leads) returns int
language sql stable set search_path = '' as $$
  select count(*)::int from public.lead_activities a
  where a.lead_id = $1.id and a.outcome in ('no_answer', 'busy')
    and a.happened_at > coalesce((select max(r.happened_at) from public.lead_activities r
                                  where r.lead_id = $1.id and r.outcome = 'reached'), '-infinity');
$$;

revoke execute on function public.call_attempts from public, anon;
grant execute on function public.call_attempts to authenticated;

-- ───────────────────────── Lost reasons ─────────────────────────
-- lost_reason becomes a code; free text moves to lost_note. No lead was Lost before this.
alter table public.leads
  drop constraint leads_check1,
  drop constraint leads_lost_reason_check,
  add column lost_note text not null default '' check (length(lost_note) <= 500),
  add constraint leads_lost_reason_check check (lost_reason in
    ('not_interested', 'budget', 'chose_competitor', 'no_response', 'not_a_fit', 'bad_timing', 'wrong_contact', 'other')),
  add constraint leads_lost_needs_reason check ((status = 'lost') = (lost_reason is not null)),
  add constraint leads_other_needs_note check (lost_reason is distinct from 'other' or length(trim(lost_note)) > 0),
  -- A follow-up date only on open leads, or on Lost (Bad timing) as the date to try again.
  add constraint leads_follow_up_when_open check (status in ('new', 'contacted', 'qualified') or next_follow_up is null or lost_reason = 'bad_timing'),
  add constraint leads_bad_timing_needs_date check (lost_reason is distinct from 'bad_timing' or next_follow_up is not null);
