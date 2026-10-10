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

export async function paymentAction(paymentId: string, action: "confirm" | "cancel", reason?: string): Promise<FormState> {
  if (!id.safeParse(paymentId).success || (action !== "confirm" && action !== "cancel")) return { error: "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("payment_action", { p_id: paymentId, p_action: action, p_reason: reason?.trim() || undefined });
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

const MAX_PROOF_BYTES = 5 * 1024 * 1024;

/** JPG, PNG, WEBP or PDF by file signature, not by name or browser-reported type (PRD §26). */
function proofType(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  if (String.fromCharCode(...b.slice(0, 5)) === "%PDF-") return "application/pdf";
  return null;
}

/**
 * Records a proof file the browser already uploaded to `<org>/payment/<payment id>/…` (PRD §20).
 * Re-checks the file on the server; anything that isn't a real JPG/PNG/WEBP/PDF under 5 MB is deleted.
 */
export async function addProof(paymentId: string, path: string, fileName: string): Promise<FormState> {
  if (!id.safeParse(paymentId).success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data: org } = await supabase.rpc("current_org_id");
  if (!org || !path.startsWith(`${org}/payment/${paymentId}/`) || path.includes("..")) return { error: "Invalid request." };

  const { data: blob } = await supabase.storage.from("documents").download(path);
  const bytes = blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  const type = bytes && bytes.length <= MAX_PROOF_BYTES ? proofType(bytes) : null;
  if (!bytes || !type) {
    await supabase.storage.from("documents").remove([path]);
    return { error: "Use a JPG, PNG, WEBP or PDF file up to 5 MB." };
  }

  const { error } = await supabase.from("documents").insert({
    organization_id: org,
    entity_type: "payment",
    entity_id: paymentId,
    path,
    file_name: fileName.slice(0, 200),
    mime_type: type,
    size_bytes: bytes.length,
  });
  if (error) {
    await supabase.storage.from("documents").remove([path]);
    return { error: "You don't have permission to do this." };
  }
  revalidatePath(`/finance/payments/${paymentId}`);
  return { ok: true };
}

export async function removeProof(paymentId: string, documentId: string): Promise<FormState> {
  if (!id.safeParse(paymentId).success || !id.safeParse(documentId).success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("documents").delete().eq("id", documentId).select("path");
  if (error || !data.length) return { error: "You don't have permission to do this." };
  await supabase.storage.from("documents").remove([data[0].path]);
  revalidatePath(`/finance/payments/${paymentId}`);
  return { ok: true };
}
