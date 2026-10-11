import { PAGE_SIZE } from "@/components/list-controls";
import { addDays } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { ACTIONS, MODULES } from "./utils";

export type AuditFilters = { page: number; module: string; user: string; action: string; from: string; to: string };

const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Filters from the URL; unknown values fall back to "all". */
export function parseAuditFilters(p: Record<string, string | string[] | undefined>): AuditFilters {
  const one = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");
  return {
    page: Math.max(1, Number.parseInt(one("page"), 10) || 1),
    module: one("module") in MODULES ? one("module") : "",
    user: one("user") === "system" || /^[0-9a-f-]{36}$/.test(one("user")) ? one("user") : "",
    action: one("action") in ACTIONS ? one("action") : "",
    from: isDate(one("from")) ? one("from") : "",
    to: isDate(one("to")) ? one("to") : "",
  };
}

/** Newest first. RLS limits the log to users with audit_logs.view (PRD §28). */
export async function listAuditLogs(f: AuditFilters) {
  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select("id, created_at, actor_id, action, table_name, record_id, before, after, reason", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((f.page - 1) * PAGE_SIZE, f.page * PAGE_SIZE - 1);
  // Counter bumps (document_sequences) accompany every numbered document; the document's own row says it all.
  query = f.module ? query.eq("table_name", f.module) : query.neq("table_name", "document_sequences");
  if (f.user === "system") query = query.is("actor_id", null);
  else if (f.user) query = query.eq("actor_id", f.user);
  if (f.action) query = query.like("action", `%.${f.action}`);
  // Dates are IST business days (PRD §8).
  if (f.from) query = query.gte("created_at", `${f.from}T00:00:00+05:30`);
  if (f.to) query = query.lt("created_at", `${addDays(f.to, 1)}T00:00:00+05:30`);

  const [{ data, count, error }, users] = await Promise.all([
    query,
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
  ]);
  if (error) throw error;
  return { rows: data, total: count ?? 0, users: users.data ?? [] };
}
