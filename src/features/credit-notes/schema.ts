import { z } from "zod";
import { discountTypeSchema, lineItemSchema, moneyString, percentDiscountError, percentDiscountOk } from "@/lib/line-items";

export const creditNoteSchema = z
  .object({
    invoice_id: z.uuid("Choose an invoice"),
    credit_note_date: z.iso.date("Pick a date"),
    reason: z.string().trim().min(1, "Give the reason").max(500),
    discount_type: discountTypeSchema,
    discount_value: moneyString,
    notes: z.string().trim().max(5000),
    items: z.array(lineItemSchema).min(1, "Add at least one line item"),
  })
  .refine(percentDiscountOk, percentDiscountError);

export type CreditNoteInput = z.input<typeof creditNoteSchema>;
export type CreditNoteStatus = "draft" | "issued" | "cancelled";

export const creditNoteLabel = (cn: { number: string | null }) => cn.number ?? "Draft";
