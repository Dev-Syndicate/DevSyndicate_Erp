import { PAGE_SIZE } from "@/components/list-controls";
import { createClient } from "@/lib/supabase/server";

export async function listInvoices({ q, page }: { q: string; page: number }) {
  const supabase = await createClient();
  let query = supabase
    .from("invoices")
    .select("id, number, status, invoice_date, due_date, grand_total, amount_paid, balance_due, clients(company_name)", { count: "exact" })
    .order("invoice_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.ilike("number", `%${q}%`);

  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

export async function getInvoice(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "*, amount_paid, amount_credited, balance_due, invoice_items(*), clients(id, company_name, billing_address, city, state, pin_code, country, gstin, client_credit), client_contacts(name, email, phone), quotations(id, number, revision, title), payment_allocations(id, amount, payments(id, number, status, kind, payment_date, method)), credit_notes(id, number, status, credit_note_date, grand_total, reason)",
    )
    .eq("id", id)
    .order("position", { referencedTable: "invoice_items" })
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Everything the invoice form needs: clients with contacts and terms, active tax rates and company defaults. */
export async function getInvoiceFormData() {
  const supabase = await createClient();
  const [clients, taxRates, settings] = await Promise.all([
    supabase
      .from("clients")
      .select("id, company_name, state, country, payment_terms_days, client_contacts(id, name, is_primary)")
      .is("deleted_at", null)
      .order("company_name"),
    supabase.from("tax_rates").select("id, name, rate").eq("is_active", true).order("rate"),
    supabase
      .from("company_settings")
      .select("state, gst_registered, round_off, show_sac, default_sac_code, payment_terms_days, invoice_terms, tax_rates(rate)")
      .maybeSingle(),
  ]);
  if (clients.error) throw clients.error;
  if (taxRates.error) throw taxRates.error;
  if (settings.error) throw settings.error;
  return { clients: clients.data, taxRates: taxRates.data, settings: settings.data };
}
