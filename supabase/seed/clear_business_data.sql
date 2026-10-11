-- Pre-launch reset: deletes ALL clients, vendors, quotations, invoices, payments, credit notes, expenses, proof records,
-- their audit history, and restarts every document counter at 1. Keeps company settings, numbering patterns,
-- tax rates, expense categories, users and roles.
-- Run only before go-live (it erases real data too): pnpm dlx supabase db query --linked -f supabase/seed/clear_business_data.sql
-- Uploaded proof files stay in Storage (bucket "documents"); empty it from the dashboard if needed.
begin;

truncate public.payment_allocations, public.documents, public.payments,
         public.credit_note_items, public.credit_notes,
         public.invoice_items, public.invoices,
         public.quotation_items, public.quotations,
         public.expenses, public.client_contacts, public.clients, public.vendors;

delete from public.document_sequences;

delete from public.audit_logs
where table_name in ('payment_allocations', 'documents', 'payments', 'credit_note_items', 'credit_notes', 'invoice_items',
                     'invoices', 'quotation_items', 'quotations', 'expenses', 'client_contacts', 'clients', 'vendors');

commit;
