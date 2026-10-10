-- Company logo and signature for PDFs (PRD §29). Private bucket; files live under '<organization_id>/'.
-- PNG/JPEG only: the PDF renderer can't draw WEBP.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', false, 2097152, array['image/png', 'image/jpeg']);

alter table public.company_settings
  add column logo_path text,
  add column signature_path text;

create policy "members read branding" on storage.objects for select to authenticated
  using (bucket_id = 'branding' and (storage.foldername(name))[1] = (select public.current_org_id())::text);
create policy "settings.update uploads branding" on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and (storage.foldername(name))[1] = (select public.current_org_id())::text
              and (select public.has_permission('settings.update')));
create policy "settings.update replaces branding" on storage.objects for update to authenticated
  using (bucket_id = 'branding' and (storage.foldername(name))[1] = (select public.current_org_id())::text
         and (select public.has_permission('settings.update')));
create policy "settings.update removes branding" on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and (storage.foldername(name))[1] = (select public.current_org_id())::text
         and (select public.has_permission('settings.update')));
