-- PAN is not needed (owner decision). Both columns were empty when dropped.
alter table public.company_settings drop column pan;
alter table public.clients drop column pan;
