import { z } from "zod";
import { paise } from "@/lib/money";
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

export type InvoiceStatus = "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "cancelled";

/**
 * Status shown to users (PRD §16), derived from balances once issued: paid when nothing is due, overdue when a
 * balance is left past the due date, partially paid when some of it is settled.
 */
export function displayStatus(
  inv: { status: string; due_date: string; amount_paid: number | null; balance_due: number | null },
  today: string,
): InvoiceStatus {
  if (inv.status !== "issued") return inv.status as InvoiceStatus;
  if (paise(inv.balance_due ?? 0) <= 0n) return "paid";
  if (inv.due_date < today) return "overdue";
  return paise(inv.amount_paid ?? 0) > 0n ? "partially_paid" : "issued";
}

export const invoiceLabel = (inv: { number: string | null }) => inv.number ?? "Draft";
