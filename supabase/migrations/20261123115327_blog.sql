-- Blog for the company website (PRD §49, v1.7): one category per post, rich-text HTML content, cover image, SEO fields.
-- Drafts stay inside the ERP; the website reads published posts through anon (RLS + column grants), never drafts.

-- ───────────────────────── Permissions ─────────────────────────
insert into public.permissions (key) values
  ('blog.view'), ('blog.create'), ('blog.update'), ('blog.delete'), ('blog.publish');

insert into public.role_permissions (role_id, permission)
select r.id, p.key from public.roles r join public.permissions p on p.key like 'blog.%'
where r.key in ('super_admin', 'admin')
   or (r.key = 'staff' and p.key in ('blog.view', 'blog.create', 'blog.update'))
   or (r.key = 'viewer' and p.key = 'blog.view');

-- ───────────────────────── Tables ─────────────────────────
create table public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null check (length(trim(name)) between 1 and 80),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 100),
  description text not null default '' check (length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  -- restrict: a category with posts can't be deleted until its posts move (PRD §49).
  category_id uuid not null references public.blog_categories(id) on delete restrict,
  title text not null check (length(trim(title)) between 1 and 200),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 100),
  excerpt text not null default '' check (length(excerpt) <= 300),
  content text not null default '' check (length(content) <= 200000),
  cover_image_path text,
  cover_image_alt text not null default '' check (length(cover_image_alt) <= 200),
  seo_title text not null default '' check (length(seo_title) <= 100),
  meta_description text not null default '' check (length(meta_description) <= 300),
  canonical_url text not null default '' check (canonical_url = '' or (canonical_url ~ '^https?://' and length(canonical_url) <= 500)),
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  check (cover_image_path is null or length(trim(cover_image_alt)) > 0),
  check (status = 'draft' or published_at is not null)
);

create index on public.blog_posts (organization_id, status, published_at desc);
create index on public.blog_posts (category_id);
create index on public.blog_posts (created_by);

-- First publish stamps the date; re-publishing keeps it (Article datePublished).
create function public.blog_post_published_at() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
  return new;
end;
$$;

create trigger set_published_at before insert or update on public.blog_posts for each row execute function public.blog_post_published_at();
create trigger set_updated_at before update on public.blog_categories for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.blog_posts for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.blog_categories for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.blog_posts for each row execute function public.audit_row_change();

-- ───────────────────────── RLS ─────────────────────────
alter table public.blog_categories enable row level security;
alter table public.blog_posts enable row level security;

create policy "blog.view reads categories" on public.blog_categories for select to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('blog.view')));
create policy "blog.update adds categories" on public.blog_categories for insert to authenticated
  with check (organization_id = (select public.current_org_id()) and (select public.has_permission('blog.update')));
create policy "blog.update edits categories" on public.blog_categories for update to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('blog.update')))
  with check (organization_id = (select public.current_org_id()));
create policy "blog.update removes categories" on public.blog_categories for delete to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('blog.update')));

create policy "blog.view reads posts" on public.blog_posts for select to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('blog.view')));
-- Drafts need create/update; anything published (publishing, unpublishing, live edits) needs blog.publish.
create policy "blog.create adds posts" on public.blog_posts for insert to authenticated
  with check (organization_id = (select public.current_org_id()) and (select public.has_permission('blog.create'))
              and (status = 'draft' or (select public.has_permission('blog.publish'))));
create policy "blog.update edits drafts, blog.publish the rest" on public.blog_posts for update to authenticated
  using (organization_id = (select public.current_org_id())
         and ((status = 'draft' and (select public.has_permission('blog.update'))) or (select public.has_permission('blog.publish'))))
  with check (organization_id = (select public.current_org_id())
              and ((status = 'draft' and (select public.has_permission('blog.update'))) or (select public.has_permission('blog.publish'))));
create policy "blog.delete removes posts" on public.blog_posts for delete to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.has_permission('blog.delete')));

-- Public website API: published posts and all categories, only the listed columns.
-- shortcut: not filtered by organization (one organization today); add an org filter if a second one is ever added.
create policy "website reads published posts" on public.blog_posts for select to anon using (status = 'published');
create policy "website reads categories" on public.blog_categories for select to anon using (true);

revoke all on public.blog_categories, public.blog_posts from anon;
grant select (id, name, slug, description) on public.blog_categories to anon;
grant select (id, category_id, title, slug, excerpt, content, cover_image_path, cover_image_alt, seo_title,
              meta_description, canonical_url, status, published_at, updated_at) on public.blog_posts to anon;

-- ───────────────────────── Cover images ─────────────────────────
-- Public bucket: the website loads covers by URL. Files live under '<organization_id>/'.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog', 'blog', true, 921600, array['image/png', 'image/jpeg', 'image/webp']);

-- Storage needs select to remove files; public URLs don't go through RLS.
create policy "blog.view reads covers" on storage.objects for select to authenticated
  using (bucket_id = 'blog' and (storage.foldername(name))[1] = (select public.current_org_id())::text
         and (select public.has_permission('blog.view')));
create policy "blog.update uploads covers" on storage.objects for insert to authenticated
  with check (bucket_id = 'blog' and (storage.foldername(name))[1] = (select public.current_org_id())::text
              and (select public.has_permission('blog.update')));
create policy "blog.update removes covers" on storage.objects for delete to authenticated
  using (bucket_id = 'blog' and (storage.foldername(name))[1] = (select public.current_org_id())::text
         and ((select public.has_permission('blog.update')) or (select public.has_permission('blog.delete'))));
