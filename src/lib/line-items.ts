import { z } from "zod";

// Line items and document discount shared by quotations and invoices. Mirror the CHECKs on *_items.

export const moneyString = z.string().trim().regex(/^\d{1,12}(\.\d{1,2})?$/, "Up to 2 decimals");
export const discountTypeSchema = z.enum(["amount", "percent"]);

/** Refinement for a percent discount (line or document): `.refine(percentDiscountOk, percentDiscountError)`. */
export const percentDiscountOk = (d: { discount_type: string; discount_value: string }) =>
  d.discount_type !== "percent" || Number(d.discount_value) <= 100;
export const percentDiscountError = { path: ["discount_value"], message: "Max 100%" };

export const lineItemSchema = z
  .object({
    description: z.string().trim().min(1, "Describe the item").max(1000),
    sac_code: z.string().trim().max(8),
    /** Quotations only: estimated time for the line, e.g. "2 days". */
    timeline: z.string().trim().max(50, "Keep it under 50 characters").optional(),
    quantity: z
      .string()
      .trim()
      .regex(/^\d{1,9}(\.\d{1,3})?$/, "Up to 3 decimals")
      .refine((v) => Number(v) > 0, "Must be more than 0"),
    unit_price: moneyString,
    discount_type: discountTypeSchema,
    discount_value: moneyString,
    tax_rate: z.string().trim().regex(/^\d{1,3}(\.\d{1,2})?$/),
  })
  .refine(percentDiscountOk, percentDiscountError);

export type LineItemInput = z.input<typeof lineItemSchema>;

/** Postgres error → message for the user. Our RPCs raise readable messages with code 22023. */
export function dbErrorMessage(error: { code?: string; message: string }) {
  if (error.code === "42501") return "You don't have permission to do this.";
  if (error.code === "22023" || error.code === "23514") return error.message;
  return "Something went wrong. Please try again.";
}
