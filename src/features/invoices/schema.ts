import { z } from "zod";
import { discountTypeSchema, lineItemSchema, moneyString, percentDiscountError, percentDiscountOk } from "@/lib/line-items";

export const invoiceSchema = z
  .object({
    client_id: z.uuid("Select a client"),
    contact_id: z.union([z.literal(""), z.uuid()]),
    invoice_date: z.iso.date(),
    due_date: z.iso.date("Pick a date"),
    place_of_supply: z.string().trim().max(100),
    discount_type: discountTypeSchema,
    discount_value: moneyString,
    terms: z.string().trim().max(5000),
    notes: z.string().trim().max(5000),
    items: z.array(lineItemSchema).min(1, "Add at least one line item"),
  })
  .refine((i) => i.due_date >= i.invoice_date, { path: ["due_date"], message: "Must be on or after the invoice date" })
  .refine(percentDiscountOk, percentDiscountError);

export type InvoiceInput = z.input<typeof invoiceSchema>;

// shortcut: paid / partially paid arrive with payments (PRD §16); until then an issued invoice's balance is its total.
export type InvoiceStatus = "draft" | "issued" | "overdue" | "cancelled";

/** Status shown to users: an issued invoice past its due date is "overdue" (derived, PRD §16). */
export function displayStatus(inv: { status: string; due_date: string }, today: string): InvoiceStatus {
  return inv.status === "issued" && inv.due_date < today ? "overdue" : (inv.status as InvoiceStatus);
}

export const invoiceLabel = (inv: { number: string | null }) => inv.number ?? "Draft";
