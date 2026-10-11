import { PAGE_SIZE } from "@/components/list-controls";
import { createClient } from "@/lib/supabase/server";

export async function listCreditNotes({ q, page }: { q: string; page: number }) {
  const supabase = await createClient();
  let query = supabase
    .from("credit_notes")
    .select("id, number, status, credit_note_date, grand_total, reason, clients(company_name), invoices(id, number)", { count: "exact" })
    .order("credit_note_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.ilike("number", `%${q}%`);

  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

export async function getCreditNote(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("credit_notes")
    .select(
      "*, credit_note_items(*), clients(id, company_name, billing_address, city, state, pin_code, country, gstin), invoices(id, number, invoice_date, grand_total, billing_name, billing_address, billing_gstin)",
    )
    .eq("id", id)
    .order("position", { referencedTable: "credit_note_items" })
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** The invoice being credited (with what is left to credit), tax rates and company defaults for the form. */
export async function getCreditNoteFormData(invoiceId: string) {
  const supabase = await createClient();
  const [invoice, taxRates, settings] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, number, invoice_date, status, grand_total, amount_credited, supply_type, gst_applicable, place_of_supply, clients(company_name), invoice_items(tax_rate, sac_code)")
      .eq("id", invoiceId)
      .maybeSingle(),
    supabase.from("tax_rates").select("id, name, rate").eq("is_active", true).order("rate"),
    supabase.from("company_settings").select("state, gst_registered, round_off, show_sac, default_sac_code, tax_rates(rate)").maybeSingle(),
  ]);
  if (invoice.error) throw invoice.error;
  if (taxRates.error) throw taxRates.error;
  if (settings.error) throw settings.error;
  return { invoice: invoice.data, taxRates: taxRates.data, settings: settings.data };
}
