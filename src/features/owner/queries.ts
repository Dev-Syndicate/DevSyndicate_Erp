import { PAGE_SIZE } from "@/components/list-controls";
import { createClient } from "@/lib/supabase/server";

export async function listOwnerTransactions({ page }: { page: number }) {
  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("owner_transactions")
    .select("id, kind, txn_date, amount, method, notes", { count: "exact" })
    .order("txn_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

export async function getOwnerTransaction(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("owner_transactions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}
