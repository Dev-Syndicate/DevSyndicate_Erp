-- Due date is optional (PRD §15, v1.3): an invoice without one is never shown as overdue.
-- save_invoice already stores null when p_data has no due_date; the check (due_date >= invoice_date) passes for null.
alter table public.invoices alter column due_date drop not null;
