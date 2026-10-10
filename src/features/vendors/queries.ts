import { PAGE_SIZE } from "@/components/list-controls";
import { createClient } from "@/lib/supabase/server";

export async function listVendors({ q, page, archived }: { q: string; page: number; archived: boolean }) {
  const supabase = await createClient();
  let query = supabase
    .from("vendors")
    .select("id, name, contact_person, email, phone, gstin, expense_categories(name)", { count: "exact" })
    .order("name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  query = archived ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);
  if (q) query = query.ilike("name", `%${q}%`);

  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

export async function getVendor(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("vendors").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}
