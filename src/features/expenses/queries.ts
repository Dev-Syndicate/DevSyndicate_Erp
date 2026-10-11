import { PAGE_SIZE } from "@/components/list-controls";
import { createClient } from "@/lib/supabase/server";

export async function listExpenses({ q, page }: { q: string; page: number }) {
  const supabase = await createClient();
  let query = supabase
    .from("expenses")
    .select("id, number, expense_date, description, amount, expense_categories(name), vendors(name)", { count: "exact" })
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  // Commas and brackets would break the PostgREST or-filter.
  const term = q.replace(/[,()]/g, " ").trim();
  if (term) query = query.or(`number.ilike.%${term}%,description.ilike.%${term}%`);

  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

export async function getExpense(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("*, expense_categories(name), vendors(id, name, gstin)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Categories and vendors for the form; archived ones only when the expense already uses them. */
export async function getExpenseFormData(current?: { category_id: string; vendor_id: string | null }) {
  const supabase = await createClient();
  const [categories, vendors, settings] = await Promise.all([
    supabase.from("expense_categories").select("id, name, is_active").order("name"),
    supabase.from("vendors").select("id, name, gstin, default_expense_category_id, deleted_at").order("name"),
    supabase.from("company_settings").select("gst_registered").maybeSingle(),
  ]);
  if (categories.error) throw categories.error;
  if (vendors.error) throw vendors.error;
  return {
    categories: categories.data.filter((c) => c.is_active || c.id === current?.category_id),
    vendors: vendors.data.filter((v) => !v.deleted_at || v.id === current?.vendor_id),
    gstRegistered: settings.data?.gst_registered ?? false,
  };
}
