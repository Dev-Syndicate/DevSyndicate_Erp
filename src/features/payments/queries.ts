import { PAGE_SIZE } from "@/components/list-controls";
import { createClient } from "@/lib/supabase/server";

export async function listPayments({ q, page }: { q: string; page: number }) {
  const supabase = await createClient();
  let query = supabase
    .from("payments")
    .select("id, number, kind, status, payment_date, amount, tds_amount, method, unallocated, clients(company_name)", { count: "exact" })
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.ilike("number", `%${q}%`);

  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

export async function getPayment(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select(
      "*, unallocated, clients(id, company_name, billing_address, city, state, pin_code, country, gstin), payment_allocations(id, amount, invoice_id, invoices(id, number, invoice_date, grand_total))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Issued invoices that still have a balance, oldest first (for allocating and applying credit). */
export async function getOpenInvoices(clientId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("invoices")
    .select("id, number, client_id, invoice_date, due_date, grand_total, balance_due")
    .eq("status", "issued")
    .order("invoice_date")
    .order("number");
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  if (error) throw error;
  return data.filter((i) => (i.balance_due ?? 0) > 0);
}

/** Active clients with their available credit (for the payment form). */
export async function getPaymentClients() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, company_name, client_credit")
    .is("deleted_at", null)
    .order("company_name");
  if (error) throw error;
  return data;
}
