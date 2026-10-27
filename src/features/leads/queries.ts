import { PAGE_SIZE } from "@/components/list-controls";
import { istToday } from "@/lib/dates";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { OPEN_STATUSES } from "./schema";

export const LEAD_VIEWS = [
  { value: "open", label: "Open" },
  { value: "due", label: "Follow-ups due" },
  { value: "no_follow_up", label: "No follow-up" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "all", label: "All" },
] as const;
export type LeadView = (typeof LEAD_VIEWS)[number]["value"];

/** Every lead (shared; RLS: leads.view). `db` = another user client, e.g. the Claude connector's (PRD §48). */
export async function listLeads({ q, page, view }: { q: string; page: number; view: LeadView }, db?: SupabaseClient<Database>) {
  const supabase = db ?? (await createClient());
  let query = supabase
    .from("leads")
    .select("id, name, company, email, phone, source, status, lost_reason, next_follow_up, follow_up_note, call_attempts", { count: "exact" })
    .order("next_follow_up", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (view === "open") query = query.in("status", OPEN_STATUSES);
  // Only open leads and Lost (Bad timing) leads carry a follow-up date (a CHECK on public.leads), so due = date passed.
  if (view === "due") query = query.lte("next_follow_up", istToday());
  if (view === "no_follow_up") query = query.in("status", OPEN_STATUSES).is("next_follow_up", null);
  if (view === "won" || view === "lost") query = query.eq("status", view);
  // Characters that would break PostgREST's or() syntax become spaces.
  const term = q.replace(/[,()*\\%]/g, " ").trim();
  if (term) query = query.or(["name", "company", "email", "phone"].map((c) => `${c}.ilike.%${term}%`).join(","));

  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

export async function getLead(id: string, db?: SupabaseClient<Database>) {
  const supabase = db ?? (await createClient());
  const { data, error } = await supabase
    .from("leads")
    .select("*, call_attempts, clients(company_name), lead_activities(*)")
    .eq("id", id)
    .order("happened_at", { referencedTable: "lead_activities", ascending: false })
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Names of users who work leads, for "added by" and "logged by". */
export async function getLeadUsers() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lead_users");
  if (error) throw error;
  return data;
}

/** Leads with a follow-up due today or earlier: open leads and Lost (Bad timing) ones to try again (dashboard). */
export async function getDueFollowUps() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("id, name, company, next_follow_up, follow_up_note")
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
