"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrors, type FormState } from "@/lib/forms";
import { dbErrorMessage } from "@/lib/line-items";
import { createClient } from "@/lib/supabase/server";
import { creditNoteSchema, type CreditNoteInput } from "./schema";

const id = z.uuid();

/** Creates a draft, or updates it when `creditNoteId` is given. Totals and tax are computed by the database. */
export async function saveCreditNote(creditNoteId: string | null, input: CreditNoteInput): Promise<FormState> {
  if (creditNoteId && !id.safeParse(creditNoteId).success) return { error: "Invalid request." };
  const parsed = creditNoteSchema.safeParse(input);
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  // Generated types can't mark SQL args nullable; p_id = null creates a new credit note.
  const { data, error } = await supabase.rpc("save_credit_note", { p_id: creditNoteId as string, p_data: parsed.data });
  if (error) return { error: dbErrorMessage(error) };

  revalidatePath("/finance/credit-notes");
  redirect(`/finance/credit-notes/${data}`);
}

/** Issue or cancel. Both change the invoice balance, and issuing can release payments to client credit. */
export async function creditNoteAction(creditNoteId: string, action: "issue" | "cancel"): Promise<FormState> {
  if (!id.safeParse(creditNoteId).success || (action !== "issue" && action !== "cancel")) return { error: "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("credit_note_action", { p_id: creditNoteId, p_action: action });
  if (error) return { error: dbErrorMessage(error) };
  revalidatePath("/finance", "layout");
  revalidatePath("/clients", "layout");
  return { ok: true };
}

export async function deleteCreditNote(creditNoteId: string) {
  if (!id.safeParse(creditNoteId).success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("credit_notes").delete().eq("id", creditNoteId).select("id");
  if (error || !data.length) return { error: "Only drafts can be deleted, and you need permission to delete." };
  revalidatePath("/finance/credit-notes");
  redirect("/finance/credit-notes");
}
