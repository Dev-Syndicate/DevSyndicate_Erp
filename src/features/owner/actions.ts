"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrors, type FormState } from "@/lib/forms";
import { dbErrorMessage } from "@/lib/line-items";
import { createClient } from "@/lib/supabase/server";
import { ownerTransactionSchema, type OwnerTransactionInput } from "./schema";

const id = z.uuid();

/** Records a drawing or capital introduced, or edits it when `transactionId` is given. Returns the id for proof uploads. */
export async function saveOwnerTransaction(transactionId: string | null, input: OwnerTransactionInput): Promise<FormState & { id?: string }> {
  if (transactionId && !id.safeParse(transactionId).success) return { error: "Invalid request." };
  const parsed = ownerTransactionSchema.safeParse(input);
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  // Generated types can't mark SQL args nullable; p_id = null records a new transaction.
  const { data, error } = await supabase.rpc("save_owner_transaction", { p_id: transactionId as string, p_data: parsed.data });
  if (error) return { error: dbErrorMessage(error) };

  revalidatePath("/", "layout");
  return { ok: true, id: data };
}

/** Deletes the transaction, then its proofs (rows and files). */
export async function deleteOwnerTransaction(transactionId: string): Promise<FormState> {
  if (!id.safeParse(transactionId).success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data: files } = await supabase.from("documents").select("id, path").eq("entity_type", "owner").eq("entity_id", transactionId);
  const { data, error } = await supabase.from("owner_transactions").delete().eq("id", transactionId).select("id");
  if (error || !data.length) return { error: "You don't have permission to delete this." };
  if (files?.length) {
    await supabase.from("documents").delete().in("id", files.map((f) => f.id));
    await supabase.storage.from("documents").remove(files.map((f) => f.path));
  }
  revalidatePath("/", "layout");
  redirect("/finance/owner");
}
