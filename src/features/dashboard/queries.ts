import { createClient } from "@/lib/supabase/server";

/** Amounts are strings (numeric as text) so money never passes through JS floats. */
export type DashboardFigures = {
  revenue: string;
  tds_receivable: string;
  expenses: string;
  tds_payable: string;
  total_invoiced: string;
  outstanding: string;
  outstanding_count: number;
  overdue: string;
  overdue_count: number;
  client_credit: string;
  pending_payments: string;
  pending_payments_count: number;
  ageing: { "0_30": string; "31_60": string; "61_90": string; "90_plus": string };
  monthly: { month: string; revenue: string; expenses: string }[];
};

/** All KPIs in one call (public.dashboard); RLS decides what the user can see. */
export async function getDashboard(from: string, to: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard", { p_from: from, p_to: to });
  if (error) throw error;
  return data as unknown as DashboardFigures;
}

export async function getDashboardLists() {
  const supabase = await createClient();
  const payments = "id, number, payment_date, amount, tds_amount, clients(company_name)";
  const [recent, pending, unpaid] = await Promise.all([
    supabase.from("payments").select(payments).eq("status", "confirmed").eq("kind", "receipt").order("payment_date", { ascending: false }).order("created_at", { ascending: false }).limit(5),
    supabase.from("payments").select(payments).eq("status", "pending").eq("kind", "receipt").order("payment_date").limit(5),
    supabase.from("invoices").select("id, number, invoice_date, balance_due, clients(company_name)").eq("status", "issued").gt("balance_due", 0).order("invoice_date").limit(5),
  ]);
  for (const r of [recent, pending, unpaid]) if (r.error) throw r.error;
  return { recent: recent.data ?? [], pending: pending.data ?? [], unpaid: unpaid.data ?? [] };
}

/** Non-finance users (no reports.view) see their recent quotations instead (PRD §10). */
export async function getRecentQuotations() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select("id, number, revision, title, status, quotation_date, clients(company_name)")
    .order("updated_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  return data;
}
