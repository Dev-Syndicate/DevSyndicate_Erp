import { PAGE_SIZE } from "@/components/list-controls";
import { createClient } from "@/lib/supabase/server";

export async function listClients({ q, page, archived }: { q: string; page: number; archived: boolean }) {
  const supabase = await createClient();
  let query = supabase
    .from("clients")
    .select("id, company_name, city, state, gstin, client_contacts(name, email, is_primary)", { count: "exact" })
    .order("company_name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  query = archived ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);
  if (q) query = query.ilike("company_name", `%${q}%`);

  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

export async function getClient(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*, client_contacts(*)")
    .eq("id", id)
    .order("is_primary", { referencedTable: "client_contacts", ascending: false })
    .maybeSingle();
  if (error) throw error;
  return data;
}
