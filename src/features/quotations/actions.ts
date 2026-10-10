"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrors, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { quotationSchema, type QuotationInput } from "./schema";

const id = z.uuid();
const ACTIONS = ["send", "accept", "reject", "cancel", "revise", "duplicate"] as const;

/** Postgres error → message for the user. Our RPCs raise readable messages with code 22023. */
function message(error: { code?: string; message: string }) {
  if (error.code === "42501") return "You don't have permission to do this.";
  if (error.code === "22023" || error.code === "23514") return error.message;
  return "Something went wrong. Please try again.";
}

/** Creates a draft, or updates it when `quotationId` is given. Totals are computed by the database. */
export async function saveQuotation(quotationId: string | null, input: QuotationInput): Promise<FormState> {
  if (quotationId && !id.safeParse(quotationId).success) return { error: "Invalid request." };
  const parsed = quotationSchema.safeParse(input);
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_quotation", { p_id: quotationId, p_data: parsed.data });
  if (error) return { error: message(error) };

  revalidatePath("/finance/quotations");
  redirect(`/finance/quotations/${data}`);
}

export async function quotationAction(quotationId: string, action: (typeof ACTIONS)[number]) {
  if (!id.safeParse(quotationId).success || !ACTIONS.includes(action)) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("quotation_action", { p_id: quotationId, p_action: action });
  if (error) return { error: message(error) };

  revalidatePath("/finance/quotations");
  revalidatePath(`/finance/quotations/${quotationId}`);
  // Revise and duplicate create a new draft: open it.
  if (data !== quotationId) redirect(`/finance/quotations/${data}/edit`);
  return { ok: true };
}

/** Extends a sent (or expired) quotation's validity so it can be accepted (PRD §12). */
export async function extendQuotationValidity(quotationId: string, validUntil: string): Promise<FormState> {
  if (!id.safeParse(quotationId).success || !z.iso.date().safeParse(validUntil).success) return { error: "Pick a valid date." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("extend_quotation_validity", { p_id: quotationId, p_valid_until: validUntil });
  if (error) return { error: message(error) };

  revalidatePath("/finance/quotations");
  revalidatePath(`/finance/quotations/${quotationId}`);
  return { ok: true };
}

export async function deleteQuotation(quotationId: string) {
  if (!id.safeParse(quotationId).success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("quotations").delete().eq("id", quotationId).select("id");
  if (error || !data.length) return { error: "Only drafts can be deleted, and you need permission to delete." };

  revalidatePath("/finance/quotations");
  redirect("/finance/quotations");
}
