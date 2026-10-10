import { z } from "zod";

const money = z.string().trim().regex(/^\d{1,12}(\.\d{1,2})?$/, "Up to 2 decimals");
const discountType = z.enum(["amount", "percent"]);

export const quotationItemSchema = z
  .object({
    description: z.string().trim().min(1, "Describe the item").max(1000),
    sac_code: z.string().trim().max(8),
    quantity: z
      .string()
      .trim()
      .regex(/^\d{1,9}(\.\d{1,3})?$/, "Up to 3 decimals")
      .refine((v) => Number(v) > 0, "Must be more than 0"),
    unit_price: money,
    discount_type: discountType,
    discount_value: money,
    tax_rate: z.string().trim().regex(/^\d{1,3}(\.\d{1,2})?$/),
  })
  .refine((i) => i.discount_type !== "percent" || Number(i.discount_value) <= 100, {
    path: ["discount_value"],
    message: "Max 100%",
  });

export const quotationSchema = z
  .object({
    client_id: z.uuid("Select a client"),
    contact_id: z.union([z.literal(""), z.uuid()]),
    quotation_date: z.iso.date(),
    valid_until: z.iso.date("Pick a date"),
    title: z.string().trim().min(1, "Give the quotation a title").max(200),
    description: z.string().trim().max(5000),
    place_of_supply: z.string().trim().max(100),
    discount_type: discountType,
    discount_value: money,
    terms: z.string().trim().max(5000),
    notes: z.string().trim().max(5000),
    items: z.array(quotationItemSchema).min(1, "Add at least one line item"),
  })
  .refine((q) => q.valid_until >= q.quotation_date, { path: ["valid_until"], message: "Must be on or after the quotation date" })
  .refine((q) => q.discount_type !== "percent" || Number(q.discount_value) <= 100, {
    path: ["discount_value"],
    message: "Max 100%",
  });

export type QuotationInput = z.input<typeof quotationSchema>;

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "cancelled" | "superseded" | "expired";

/** Status shown to users: a sent quotation past its validity is "expired" (derived, PRD §12). */
export function displayStatus(status: string, validUntil: string, today: string): QuotationStatus {
  return status === "sent" && validUntil < today ? "expired" : (status as QuotationStatus);
}
