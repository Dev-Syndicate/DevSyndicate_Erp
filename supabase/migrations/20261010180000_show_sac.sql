-- Show or hide the SAC column on quotation and invoice line items, independent of GST registration.
-- Lines always store a SAC code (the company default when hidden).
alter table public.company_settings add column show_sac boolean not null default false;
