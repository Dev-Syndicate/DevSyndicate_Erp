import { PAGE_SIZE } from "@/components/list-controls";
import { istToday } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const LEAD_VIEWS = [
  { value: "open", label: "Open" },
  { value: "due", label: "Follow-ups due" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "all", label: "All" },
] as const;
export type LeadView = (typeof LEAD_VIEWS)[number]["value"];

const OPEN = ["new", "contacted", "qualified"];

/** Leads the user may see (RLS: own leads, or all with leads.view_all). */
export async function listLeads({ q, page, view }: { q: string; page: number; view: LeadView }) {
  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select("id, name, company, email, phone, source, status, owner_id, next_follow_up, follow_up_note", { count: "exact" })
    .order("next_follow_up", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (view === "open") query = query.in("status", OPEN);
  if (view === "due") query = query.in("status", OPEN).lte("next_follow_up", istToday());
  if (view === "won" || view === "lost") query = query.eq("status", view);
  // Characters that would break PostgREST's or() syntax become spaces.
  const term = q.replace(/[,()*\\%]/g, " ").trim();
  if (term) query = query.or(["name", "company", "email", "phone"].map((c) => `${c}.ilike.%${term}%`).join(","));

  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

export async function getLead(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*, clients(company_name), lead_activities(*)")
    .eq("id", id)
    .order("happened_at", { referencedTable: "lead_activities", ascending: false })
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Users who can hold leads, for owner names and the owner picker. */
export async function getLeadOwners() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lead_owners");
  if (error) throw error;
  return data;
}

/** The signed-in user's open leads with a follow-up due today or earlier (dashboard). */
export async function getMyDueFollowUps() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) return [];
  const { data, error } = await supabase
    .from("leads")
    .select("id, name, company, next_follow_up, follow_up_note")
    .eq("owner_id", claims.claims.sub)
    .in("status", OPEN)
    .lte("next_follow_up", istToday())
    .order("next_follow_up")
    .limit(8);
  if (error) throw error;
  return data;
}

/** Active clients for "link to an existing client" when a lead is won. */
export async function getClientOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("id, company_name").is("deleted_at", null).order("company_name");
  if (error) throw error;
  return data;
}
