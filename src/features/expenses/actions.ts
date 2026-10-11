"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrors, type FormState } from "@/lib/forms";
import { dbErrorMessage } from "@/lib/line-items";
import { createClient } from "@/lib/supabase/server";
import { expenseSchema, type ExpenseInput } from "./schema";

const id = z.uuid();

/** Records an expense, or edits it when `expenseId` is given. The database checks every amount. */
export async function saveExpense(expenseId: string | null, input: ExpenseInput): Promise<FormState> {
  if (expenseId && !id.safeParse(expenseId).success) return { error: "Invalid request." };
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  // Generated types can't mark SQL args nullable; p_id = null records a new expense.
  const { data, error } = await supabase.rpc("save_expense", { p_id: expenseId as string, p_data: parsed.data });
  if (error) return { error: dbErrorMessage(error) };

  revalidatePath("/finance", "layout");
  redirect(`/finance/expenses/${data}`);
}

/** Deletes the expense, then its receipts (rows and files). */
export async function deleteExpense(expenseId: string): Promise<FormState> {
  if (!id.safeParse(expenseId).success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data: files } = await supabase.from("documents").select("id, path").eq("entity_type", "expense").eq("entity_id", expenseId);
  const { data, error } = await supabase.from("expenses").delete().eq("id", expenseId).select("id");
  if (error || !data.length) return { error: "You don't have permission to delete expenses." };
  if (files?.length) {
    await supabase.from("documents").delete().in("id", files.map((f) => f.id));
    await supabase.storage.from("documents").remove(files.map((f) => f.path));
  }
  revalidatePath("/finance", "layout");
  redirect("/finance/expenses");
}
