"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrors, type FormState } from "@/lib/forms";
import { dbErrorMessage } from "@/lib/line-items";
import { createClient } from "@/lib/supabase/server";
import { quotationSchema, type QuotationInput } from "./schema";

const id = z.uuid();
const ACTIONS = ["send", "accept", "reject", "cancel", "revise", "duplicate"] as const;

/** Creates a draft, or updates it when `quotationId` is given. Totals are computed by the database. */
export async function saveQuotation(quotationId: string | null, input: QuotationInput): Promise<FormState> {
  if (quotationId && !id.safeParse(quotationId).success) return { error: "Invalid request." };
  const parsed = quotationSchema.safeParse(input);
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  // Generated types can't mark SQL args nullable; p_id = null creates a new quotation.
  const { data, error } = await supabase.rpc("save_quotation", { p_id: quotationId as string, p_data: parsed.data });
  if (error) return { error: dbErrorMessage(error) };

  revalidatePath("/finance/quotations");
  redirect(`/finance/quotations/${data}`);
}

export async function quotationAction(quotationId: string, action: (typeof ACTIONS)[number]) {
  if (!id.safeParse(quotationId).success || !ACTIONS.includes(action)) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("quotation_action", { p_id: quotationId, p_action: action });
  if (error) return { error: dbErrorMessage(error) };

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
  if (error) return { error: dbErrorMessage(error) };

  revalidatePath("/finance/quotations");
  revalidatePath(`/finance/quotations/${quotationId}`);
  return { ok: true };
}

export type ConvertInput =
  | { mode: "full" }
  | { mode: "percent"; percent: string }
  | { mode: "items"; items: { id: string; quantity: string }[] };

const convertSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("full") }),
  z.object({ mode: z.literal("percent"), percent: z.string().trim().regex(/^\d{1,3}(\.\d{1,2})?$/, "Up to 2 decimals") }),
  z.object({
    mode: z.literal("items"),
    items: z.array(z.object({ id: z.uuid(), quantity: z.string().trim().regex(/^\d{1,9}(\.\d{1,3})?$/) })).min(1, "Select at least one line"),
  }),
]);

/** Creates a draft invoice from an accepted quotation (PRD §14) and opens it for editing. */
export async function convertQuotation(quotationId: string, input: ConvertInput): Promise<FormState> {
  const parsed = convertSchema.safeParse(input);
  if (!id.safeParse(quotationId).success) return { error: "Invalid request." };
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const c = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_quotation", {
    p_id: quotationId,
    p_mode: c.mode,
    p_percent: c.mode === "percent" ? Number(c.percent) : undefined,
    p_items: c.mode === "items" ? c.items : undefined,
  });
  if (error) return { error: dbErrorMessage(error) };

  revalidatePath("/finance/invoices");
  redirect(`/finance/invoices/${data}/edit`);
}

export async function deleteQuotation(quotationId: string) {
  if (!id.safeParse(quotationId).success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("quotations").delete().eq("id", quotationId).select("id");
  if (error || !data.length) return { error: "Only drafts can be deleted, and you need permission to delete." };

  revalidatePath("/finance/quotations");
  redirect("/finance/quotations");
}
