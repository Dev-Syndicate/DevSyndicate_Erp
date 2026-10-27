"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrors, type FormState } from "@/lib/forms";
import { dbErrorMessage } from "@/lib/line-items";
import { createClient } from "@/lib/supabase/server";
import { activitySchema, leadRow, leadSchema, lostSchema, OPEN_STATUSES, type ActivityInput, type LeadInput, type LostInput } from "./schema";

const NO_PERMISSION = "You don't have permission to do this.";
const id = z.uuid();

export type Duplicate = { kind: string; name: string; detail: string };

/**
 * Creates a lead, or edits it when `leadId` is given. Same email or phone as another lead or client contact returns
 * `duplicates` first; saving again with `allowDuplicate` goes ahead (PRD §47: warn only).
 */
export async function saveLead(
  leadId: string | null,
  input: LeadInput,
  allowDuplicate = false,
): Promise<FormState & { duplicates?: Duplicate[] }> {
  if (leadId && !id.safeParse(leadId).success) return { error: "Invalid request." };
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const row = leadRow(parsed.data);

  const supabase = await createClient();
  if (!allowDuplicate) {
    // Generated types can't mark SQL args nullable; p_exclude = null checks against every lead.
    const { data: duplicates } = await supabase.rpc("lead_duplicates", { p_email: row.email, p_phone: row.phone, p_exclude: leadId as string });
    if (duplicates?.length) return { duplicates };
  }

  let saved = leadId;
  if (leadId) {
    const { data, error } = await supabase.from("leads").update(row).eq("id", leadId).select("id");
    if (error || !data.length) return { error: error ? dbErrorMessage(error) : NO_PERMISSION };
  } else {
    const { data: organizationId } = await supabase.rpc("current_org_id");
    if (!organizationId) return { error: NO_PERMISSION };
    const { data, error } = await supabase.from("leads").insert({ ...row, organization_id: organizationId }).select("id").single();
    if (error) return { error: dbErrorMessage(error) };
    saved = data.id;
  }

  revalidatePath("/leads");
  redirect(`/leads/${saved}`);
}

export async function deleteLead(leadId: string) {
  if (!id.safeParse(leadId).success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").delete().eq("id", leadId).select("id");
  if (error || !data.length) return { error: "Only open or lost leads can be deleted, and you need permission to delete." };
  revalidatePath("/leads");
  redirect("/leads");
}

/** Lost with a reason from the list (PRD §47); Bad timing keeps the try-again date as the next follow-up. */
export async function markLeadLost(leadId: string, input: LostInput): Promise<FormState> {
  if (!id.safeParse(leadId).success) return { error: "Invalid request." };
  const parsed = lostSchema.safeParse(input);
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const { lost_reason, lost_note, next_follow_up } = parsed.data;
  const badTiming = lost_reason === "bad_timing";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update({ status: "lost", lost_reason, lost_note, next_follow_up: badTiming ? next_follow_up : null, follow_up_note: badTiming ? "Try again" : "" })
    .eq("id", leadId)
    .select("id");
  if (error || !data.length) return { error: error ? dbErrorMessage(error) : NO_PERMISSION };
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

/** Logs a call, meeting, message or note, and sets (or clears) the next follow-up in the same step. */
export async function logActivity(leadId: string, input: ActivityInput): Promise<FormState> {
  if (!id.safeParse(leadId).success) return { error: "Invalid request." };
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const { kind, outcome, body, next_follow_up, follow_up_note } = parsed.data;

  const supabase = await createClient();
  const { data: organizationId } = await supabase.rpc("current_org_id");
  if (!organizationId) return { error: NO_PERMISSION };
  const { error } = await supabase
    .from("lead_activities")
    .insert({ organization_id: organizationId, lead_id: leadId, kind, body, outcome: kind === "call" ? outcome : null });
  if (error) return { error: NO_PERMISSION };

  const followUp = await supabase
    .from("leads")
    .update({ next_follow_up: next_follow_up || null, follow_up_note: next_follow_up ? follow_up_note : "" })
    .eq("id", leadId)
    .in("status", OPEN_STATUSES) // a Lost lead keeps its try-again date (Bad timing) or none
    .select("id");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  if (followUp.error) return { error: "The activity was saved, but the follow-up could not be changed." };
  return { ok: true };
}

/** Won: creates a client from the lead, or links an existing one (`clientId`), then opens the client. */
export async function convertLead(leadId: string, clientId: string | null): Promise<FormState> {
  if (!id.safeParse(leadId).success || (clientId && !id.safeParse(clientId).success)) return { error: "Invalid request." };
  const supabase = await createClient();
  // Generated types can't mark SQL args nullable; p_client_id = null creates the client.
  const { data, error } = await supabase.rpc("convert_lead", { p_id: leadId, p_client_id: clientId as string });
  if (error) return { error: dbErrorMessage(error) };
  revalidatePath("/leads");
  revalidatePath("/clients");
  redirect(`/clients/${data}`);
}
