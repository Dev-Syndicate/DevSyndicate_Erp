import { createClient } from "@/lib/supabase/server";

export async function getCompanySettings() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("company_settings").select("*").maybeSingle();
  if (error) throw error;
  return data;
}

export async function getTaxRates() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tax_rates").select("id, name, rate, is_active").order("rate");
  if (error) throw error;
  return data;
}

export async function getExpenseCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("expense_categories").select("id, name, is_active").order("name");
  if (error) throw error;
  return data;
}

export async function getDocumentNumbering() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("document_numbering_settings");
  if (error) throw error;
  return data;
}
