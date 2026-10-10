import { z } from "zod";
import { discountTypeSchema, lineItemSchema, moneyString, percentDiscountError, percentDiscountOk } from "@/lib/line-items";
import { paise } from "@/lib/money";

export const quotationSchema = z
  .object({
    client_id: z.uuid("Select a client"),
    contact_id: z.union([z.literal(""), z.uuid()]),
    quotation_date: z.iso.date(),
    valid_until: z.iso.date("Pick a date"),
    title: z.string().trim().min(1, "Give the quotation a title").max(200),
    description: z.string().trim().max(5000),
    place_of_supply: z.string().trim().max(100),
    discount_type: discountTypeSchema,
    discount_value: moneyString,
    terms: z.string().trim().max(5000),
    notes: z.string().trim().max(5000),
    items: z.array(lineItemSchema).min(1, "Add at least one line item"),
  })
  .refine((q) => q.valid_until >= q.quotation_date, { path: ["valid_until"], message: "Must be on or after the quotation date" })
  .refine(percentDiscountOk, percentDiscountError);

export type QuotationInput = z.input<typeof quotationSchema>;

export type QuotationStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "partially_invoiced"
  | "invoiced"
  | "rejected"
  | "cancelled"
  | "superseded"
  | "expired";

/**
 * Status shown to users (PRD §12): a sent quotation past its validity is "expired"; an accepted one is
 * "partially invoiced" / "invoiced" once issued invoices cover part / all of its total. All derived, not stored.
 */
export function displayStatus(
  q: { status: string; valid_until: string; grand_total: number; invoiced_total: number | null },
  today: string,
): QuotationStatus {
  if (q.status === "sent" && q.valid_until < today) return "expired";
  const invoiced = paise(q.invoiced_total ?? 0);
  if (q.status === "accepted" && invoiced > 0n) return invoiced >= paise(q.grand_total) ? "invoiced" : "partially_invoiced";
  return q.status as QuotationStatus;
}
