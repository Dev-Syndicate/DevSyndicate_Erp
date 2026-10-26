import { PAGE_SIZE } from "@/components/list-controls";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

/** `db` = another user client, e.g. the Claude connector's (PRD §48). */
export async function listQuotations({ q, page }: { q: string; page: number }, db?: SupabaseClient<Database>) {
  const supabase = db ?? (await createClient());
  let query = supabase
    .from("quotations")
    .select("id, number, revision, title, status, quotation_date, valid_until, grand_total, invoiced_total, clients(company_name)", {
      count: "exact",
    })
    .order("quotation_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  // Commas/parentheses would break the PostgREST or() filter; search terms don't need them.
  const term = q.replace(/[,()]/g, " ").trim();
  if (term) query = query.or(`title.ilike.%${term}%,number.ilike.%${term}%`);

  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

export async function getQuotation(id: string, db?: SupabaseClient<Database>) {
  const supabase = db ?? (await createClient());
  const { data, error } = await supabase
    .from("quotations")
    .select(
      "*, invoiced_total, quotation_items(*), clients(id, company_name, billing_address, city, state, pin_code, country, gstin), client_contacts(name, email, phone), invoices(id, number, status, invoice_date, grand_total)",
    )
    .eq("id", id)
    .order("position", { referencedTable: "quotation_items" })
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Everything the quotation form needs: clients with contacts, active tax rates and company defaults. */
export async function getQuotationFormData() {
  const supabase = await createClient();
  const [clients, taxRates, settings] = await Promise.all([
    supabase
      .from("clients")
      .select("id, company_name, state, country, client_contacts(id, name, is_primary)")
      .is("deleted_at", null)
      .order("company_name"),
    supabase.from("tax_rates").select("id, name, rate").eq("is_active", true).order("rate"),
    supabase
      .from("company_settings")
      .select("state, gst_registered, round_off, show_sac, default_sac_code, quotation_validity_days, quotation_terms, tax_rates(rate)")
      .maybeSingle(),
  ]);
  if (clients.error) throw clients.error;
  if (taxRates.error) throw taxRates.error;
  if (settings.error) throw settings.error;
  return { clients: clients.data, taxRates: taxRates.data, settings: settings.data };
}
