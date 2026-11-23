-- Self-check for the website contact form (PRD §47, v1.7): only the right key creates a lead, the lead lands as a
-- New Website lead due today with the need and message in notes, double submits are ignored, anon can't read leads,
-- 3 enquiries per visitor an hour and 3 per email a day; the visitor IP is stored only as a hash.
-- Rolls back.
begin;

update public.company_settings set website_form_key_hash = encode(sha256(convert_to('test-form-key', 'UTF8')), 'hex');

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
do $$ begin
  begin
    perform public.submit_website_lead('wrong-key', 'Jane', 'jane@test.local', '', '', 'Hi');
    assert false, 'a wrong key is refused';
  exception when insufficient_privilege then null; end;
  begin
    perform public.submit_website_lead('test-form-key', 'Jane', 'jane@test.local', '', '', '   ');
    assert false, 'a message is required';
  exception when invalid_parameter_value then null; end;
  perform public.submit_website_lead('test-form-key', ' Jane Okafor ', ' Jane@Test.Local ', 'Okafor Labs', 'AI Systems', 'We need a support bot.', '203.0.113.7');
  perform public.submit_website_lead('test-form-key', 'Jane Okafor', 'jane@test.local', '', '', 'Clicked twice');
  -- Same visitor, other emails: the 4th in an hour is refused
  perform public.submit_website_lead('test-form-key', 'Bot', 'bot1@test.local', '', '', 'Spam', '203.0.113.7');
  perform public.submit_website_lead('test-form-key', 'Bot', 'bot2@test.local', '', '', 'Spam', '203.0.113.7');
  begin
    perform public.submit_website_lead('test-form-key', 'Bot', 'bot3@test.local', '', '', 'Spam', '203.0.113.7');
    assert false, 'visitor limit';
  exception when program_limit_exceeded then null; end;
  perform public.submit_website_lead('test-form-key', 'Someone', 'other@test.local', '', '', 'Hi', '198.51.100.1');
  begin
    perform 1 from public.leads;
    assert false, 'the website cannot read leads';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
do $$ begin
  assert (select count(*) from public.leads where email = 'jane@test.local') = 1, 'double submit saved once';
  assert (
    select name = 'Jane Okafor' and company = 'Okafor Labs' and source = 'website' and source_detail = 'Contact form' and status = 'new'
       and notes = E'Needs: AI Systems\n\nWe need a support bot.' and next_follow_up = public.ist_today() and created_by is null
    from public.leads where email = 'jane@test.local'
  ), 'saved as a New Website lead due today';
  assert (select visitor_ip_hash ~ '^[0-9a-f]{64}$' from public.leads where email = 'jane@test.local'), 'visitor IP stored only as a hash';
  assert (select count(*) from public.leads where email like 'bot%@test.local') = 2, 'blocked call saved nothing';
  -- Same email over a day: the 4th is refused (older ones moved past the 10-minute double-submit window)
  update public.leads set created_at = now() - interval '1 hour' where email = 'other@test.local';
  insert into public.leads (organization_id, name, email, source, created_at)
  select organization_id, 'Other', 'other@test.local', 'website', now() - interval '2 hours' from public.leads where email = 'other@test.local'
  union all
  select organization_id, 'Other', 'other@test.local', 'website', now() - interval '3 hours' from public.leads where email = 'other@test.local';
  begin
    perform public.submit_website_lead('test-form-key', 'Other', 'other@test.local', '', '', 'Again', '198.51.100.2');
    assert false, 'email limit';
  exception when program_limit_exceeded then null; end;
end $$;

select 'website leads checks passed' as result;
rollback;
