-- Self-check for the blog (PRD §49, v1.7): staff write drafts, only blog.publish publishes or edits live posts,
-- published date kept on re-publish, categories with posts can't be deleted, the website (anon) sees only
-- published posts and only public columns. Rolls back.
begin;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
select gen_random_uuid(), r.key || '@test.local', jsonb_build_object('role_id', r.id), '{}', 'authenticated', 'authenticated'
from public.roles r where r.key in ('admin', 'finance', 'staff');
create temp table u as select email, id from public.profiles where email like '%@test.local';
grant select on u to authenticated;

create function pg_temp.act_as(e text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', (select id from u where email = e), 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- Staff: categories and drafts, never published
select pg_temp.act_as('staff@test.local');
do $$
declare cat uuid;
begin
  insert into public.blog_categories (organization_id, name, slug) values (public.current_org_id(), 'Tech News', 'tech-news-test') returning id into cat;
  begin
    insert into public.blog_categories (organization_id, name, slug) values (public.current_org_id(), 'Bad', 'Bad Slug');
    assert false, 'slugs are lowercase-with-dashes';
  exception when check_violation then null; end;
  insert into public.blog_posts (organization_id, category_id, title, slug, content)
  values (public.current_org_id(), cat, 'Tailwind v5 is out', 'tailwind-v5-test', '<p>Hello</p>');
  assert (select status = 'draft' and published_at is null from public.blog_posts where slug = 'tailwind-v5-test'), 'new posts are drafts';
  begin
    insert into public.blog_posts (organization_id, category_id, title, slug, status)
    values (public.current_org_id(), cat, 'Sneaky', 'sneaky-test', 'published');
    assert false, 'staff cannot publish on create';
  exception when insufficient_privilege then null; end;
  begin
    update public.blog_posts set status = 'published' where slug = 'tailwind-v5-test';
    assert false, 'staff cannot publish';
  exception when insufficient_privilege then null; end;
  begin
    update public.blog_posts set cover_image_path = 'x/cover.png' where slug = 'tailwind-v5-test';
    assert false, 'a cover needs alt text';
  exception when check_violation then null; end;
  begin
    insert into public.blog_posts (organization_id, category_id, title, slug) values (public.current_org_id(), cat, 'Dup', 'tailwind-v5-test');
    assert false, 'slugs are unique';
  exception when unique_violation then null; end;
  begin
    delete from public.blog_categories where id = cat;
    assert false, 'a category with posts cannot be deleted';
  exception when foreign_key_violation then null; end;
  delete from public.blog_posts where slug = 'tailwind-v5-test';
  assert exists (select 1 from public.blog_posts where slug = 'tailwind-v5-test'), 'staff cannot delete posts';
end $$;

-- Admin publishes; date kept on re-publish
select pg_temp.act_as('admin@test.local');
do $$
declare first timestamptz;
begin
  update public.blog_posts set status = 'published' where slug = 'tailwind-v5-test';
  select published_at into first from public.blog_posts where slug = 'tailwind-v5-test';
  assert first is not null, 'publishing stamps the date';
  update public.blog_posts set status = 'draft' where slug = 'tailwind-v5-test';
  update public.blog_posts set status = 'published' where slug = 'tailwind-v5-test';
  assert (select published_at from public.blog_posts where slug = 'tailwind-v5-test') = first, 're-publishing keeps the first date';
  insert into public.blog_posts (organization_id, category_id, title, slug)
  select public.current_org_id(), category_id, 'Still a draft', 'draft-test' from public.blog_posts where slug = 'tailwind-v5-test';
end $$;

-- Staff can't edit the live post; finance sees no blog
select pg_temp.act_as('staff@test.local');
do $$ begin
  update public.blog_posts set title = 'Changed' where slug = 'tailwind-v5-test';
  assert (select title from public.blog_posts where slug = 'tailwind-v5-test') = 'Tailwind v5 is out', 'live posts need blog.publish';
end $$;
select pg_temp.act_as('finance@test.local');
do $$ begin
  assert not exists (select 1 from public.blog_posts), 'finance has no blog.view';
end $$;

-- The website (anon): published only, public columns only, no writes
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
do $$ begin
  assert exists (select 1 from public.blog_posts where slug = 'tailwind-v5-test'), 'website sees published posts';
  assert not exists (select 1 from public.blog_posts where slug = 'draft-test'), 'website never sees drafts';
  assert exists (select 1 from public.blog_categories where slug = 'tech-news-test'), 'website sees categories';
  begin
    perform created_by from public.blog_posts;
    assert false, 'internal columns are hidden';
  exception when insufficient_privilege then null; end;
  begin
    perform organization_id from public.blog_categories;
    assert false, 'category organization is hidden';
  exception when insufficient_privilege then null; end;
  begin
    update public.blog_posts set title = 'Hacked';
    assert false, 'website cannot write';
  exception when insufficient_privilege then null; end;
end $$;

select 'blog checks passed' as result;
rollback;
