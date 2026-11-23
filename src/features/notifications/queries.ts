import { createClient } from "@/lib/supabase/server";

/** The signed-in user's latest notifications and unread count (RLS: own rows only, PRD §50). */
export async function getNotifications() {
  const supabase = await createClient();
  const [list, unread] = await Promise.all([
    supabase.from("notifications").select("id, kind, title, body, link, read_at, created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  if (list.error) throw list.error;
  return { rows: list.data, unread: unread.count ?? 0 };
}
