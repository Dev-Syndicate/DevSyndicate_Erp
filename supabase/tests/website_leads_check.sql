-- Self-check for the website contact form (PRD §47, v1.7): only the right key creates a lead, the lead lands as a
-- New Website lead due today with the need and message in notes, double submits are ignored, anon can't read leads.
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
  perform public.submit_website_lead('test-form-key', ' Jane Okafor ', ' Jane@Test.Local ', 'Okafor Labs', 'AI Systems', 'We need a support bot.');
  perform public.submit_website_lead('test-form-key', 'Jane Okafor', 'jane@test.local', '', '', 'Clicked twice');
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
end $$;

select 'website leads checks passed' as result;
rollback;
