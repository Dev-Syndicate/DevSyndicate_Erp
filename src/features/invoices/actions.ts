"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrors, type FormState } from "@/lib/forms";
import { dbErrorMessage } from "@/lib/line-items";
import { createClient } from "@/lib/supabase/server";
import { invoiceSchema, type InvoiceInput } from "./schema";

const id = z.uuid();
const ACTIONS = ["issue", "cancel", "duplicate"] as const;

/** Creates a draft, or updates it when `invoiceId` is given. Totals are computed by the database. */
export async function saveInvoice(invoiceId: string | null, input: InvoiceInput): Promise<FormState> {
  if (invoiceId && !id.safeParse(invoiceId).success) return { error: "Invalid request." };
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  // Generated types can't mark SQL args nullable; p_id = null creates a new invoice.
  const { data, error } = await supabase.rpc("save_invoice", { p_id: invoiceId as string, p_data: parsed.data });
  if (error) return { error: dbErrorMessage(error) };

  revalidatePath("/finance/invoices");
  redirect(`/finance/invoices/${data}`);
}

/**
 * Issue, cancel or duplicate. Issuing past the quotation total returns `needsReason` until a reason is given
 * (the database checks quotations.convert and stores the reason, PRD §14).
 */
export async function invoiceAction(
  invoiceId: string,
  action: (typeof ACTIONS)[number],
  reason?: string,
  /** Issue only: then apply the client's available credit (advances), oldest receipts first. */
  applyCredit?: boolean,
): Promise<FormState & { needsReason?: boolean; applied?: number }> {
  if (!id.safeParse(invoiceId).success || !ACTIONS.includes(action)) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invoice_action", { p_id: invoiceId, p_action: action, p_reason: reason?.trim() || undefined });
  if (error) return { error: dbErrorMessage(error), needsReason: error.hint === "override_reason" };

  // Separate step: if it fails the invoice stays issued and credit can still be applied from the payment.
  const credit = action === "issue" && applyCredit ? await supabase.rpc("apply_client_credit", { p_invoice_id: invoiceId }) : null;

  // Invoices, quotations (invoiced status) and payments (credit left) all change.
  revalidatePath("/finance", "layout");
  // Duplicate creates a new draft: open it.
  if (data !== invoiceId) redirect(`/finance/invoices/${data}/edit`);
  if (credit?.error) return { ok: true, error: `Invoice issued, but the credit wasn't applied: ${dbErrorMessage(credit.error)}` };
  return { ok: true, applied: credit?.data };
}

export async function deleteInvoice(invoiceId: string) {
  if (!id.safeParse(invoiceId).success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("invoices").delete().eq("id", invoiceId).select("id");
  if (error || !data.length) return { error: "Only drafts can be deleted, and you need permission to delete." };

  revalidatePath("/finance/invoices");
  redirect("/finance/invoices");
}
