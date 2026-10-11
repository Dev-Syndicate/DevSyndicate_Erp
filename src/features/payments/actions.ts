"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrors, type FormState } from "@/lib/forms";
import { dbErrorMessage } from "@/lib/line-items";
import { toScaled } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { paymentSchema, type PaymentInput } from "./schema";

const id = z.uuid();

/** Payments change invoice balances and client credit: refresh everything that shows them. */
function revalidateMoney(paymentId?: string) {
  revalidatePath("/finance", "layout");
  revalidatePath("/clients", "layout");
  if (paymentId) revalidatePath(`/finance/payments/${paymentId}`);
}

/** Records a pending payment, or edits it when `paymentId` is given. The database checks every amount. */
export async function savePayment(paymentId: string | null, input: PaymentInput): Promise<FormState> {
  if (paymentId && !id.safeParse(paymentId).success) return { error: "Invalid request." };
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  // Generated types can't mark SQL args nullable; p_id = null records a new payment.
  const { data, error } = await supabase.rpc("save_payment", { p_id: paymentId as string, p_data: parsed.data });
  if (error) return { error: dbErrorMessage(error) };

  revalidateMoney();
  redirect(`/finance/payments/${data}`);
}

/** Confirm or cancel. Confirming records when the money arrived and its bank reference (known only then). */
export async function paymentAction(
  paymentId: string,
  action: "confirm" | "cancel",
  reason?: string,
  received?: { payment_date: string; reference: string },
): Promise<FormState> {
  if (!id.safeParse(paymentId).success || (action !== "confirm" && action !== "cancel")) return { error: "Invalid request." };
  if (received && (!z.iso.date().safeParse(received.payment_date).success || received.reference.length > 100)) {
    return { error: "Check the date and reference." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("payment_action", {
    p_id: paymentId,
    p_action: action,
    p_reason: reason?.trim() || undefined,
    p_reference: received?.reference.trim() || undefined,
    p_payment_date: received?.payment_date,
  });
  if (error) return { error: dbErrorMessage(error) };
  revalidateMoney(paymentId);
  return { ok: true };
}

export async function deletePayment(paymentId: string) {
  if (!id.safeParse(paymentId).success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("payments").delete().eq("id", paymentId).select("id");
  if (error || !data.length) return { error: "Only pending payments can be deleted, and you need permission to delete." };
  revalidateMoney();
  redirect("/finance/payments");
}

/** Applies part of a confirmed receipt (client credit) to an invoice. */
export async function applyPayment(paymentId: string, invoiceId: string, amount: string): Promise<FormState> {
  if (!id.safeParse(paymentId).success || !id.safeParse(invoiceId).success) return { error: "Invalid request." };
  const value = toScaled(amount, 2);
  if (!value || value <= 0n) return { error: "Enter an amount above 0." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_payment", { p_payment_id: paymentId, p_invoice_id: invoiceId, p_amount: Number(amount) });
  if (error) return { error: dbErrorMessage(error) };
  revalidateMoney(paymentId);
  return { ok: true };
}

/** Removes an invoice allocation from a confirmed receipt; the amount returns to client credit. */
export async function unapplyPayment(paymentId: string, allocationId: string): Promise<FormState> {
  if (!id.safeParse(paymentId).success || !id.safeParse(allocationId).success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("unapply_payment", { p_allocation_id: allocationId });
  if (error) return { error: dbErrorMessage(error) };
  revalidateMoney(paymentId);
  return { ok: true };
}
