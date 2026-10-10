import { z } from "zod";
import { INDIAN_STATES } from "@/lib/india";

// Empty string = not set; otherwise must match. Mirrors the CHECK constraints in the settings migration.
const optionalCode = (re: RegExp, message: string) =>
  z.string().trim().toUpperCase().refine((v) => v === "" || re.test(v), message);

const text = z.string().trim().max(500);
const prefix = z.string().trim().toUpperCase().regex(/^[A-Z]{1,5}$/, "1–5 letters");

export const companySettingsSchema = z
  .object({
    legal_name: z.string().trim().min(1, "Required").max(200),
    trade_name: text,
    address: text,
    city: text,
    state: z.union([z.literal(""), z.enum(INDIAN_STATES.map((s) => s.name))]),
    pin_code: z.string().trim().refine((v) => v === "" || /^[1-9][0-9]{5}$/.test(v), "6-digit PIN code"),
    email: z.union([z.literal(""), z.email("Invalid email")]),
    phone: text,
    website: text,
    pan: optionalCode(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN"),

    gst_registered: z.boolean(),
    gstin: optionalCode(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Invalid GSTIN"),
    default_sac_code: z.string().trim().regex(/^[0-9]{4,8}$/, "4–8 digits"),
    default_tax_rate_id: z.union([z.literal(""), z.uuid()]).transform((v) => v || null),
    lut_number: text,
    lut_valid_until: z.union([z.literal(""), z.iso.date()]).transform((v) => v || null),

    bank_name: text,
    bank_account_name: text,
    bank_account_number: z.string().trim().refine((v) => v === "" || /^[0-9]{6,18}$/.test(v), "6–18 digits"),
    bank_ifsc: optionalCode(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC"),
    upi_id: z.string().trim().refine((v) => v === "" || /^[\w.-]+@[\w]+$/.test(v), "Invalid UPI ID"),

    prefix_quotation: prefix,
    prefix_invoice: prefix,
    prefix_credit_note: prefix,
    prefix_receipt: prefix,
    prefix_expense: prefix,
    quotation_validity_days: z.coerce.number().int().min(1).max(365),
    payment_terms_days: z.coerce.number().int().min(0).max(365),
    quotation_terms: z.string().trim().max(5000),
    invoice_terms: z.string().trim().max(5000),
    round_off: z.boolean(),
    signatory_name: text,
  })
  .refine((s) => !s.gst_registered || s.gstin !== "", { path: ["gstin"], message: "Required when GST-registered" })
  .refine((s) => !s.gstin || !s.state || s.gstin.startsWith(INDIAN_STATES.find((x) => x.name === s.state)!.code), {
    path: ["gstin"],
    message: "GSTIN state code does not match the company state",
  });

export const taxRateSchema = z.object({
  name: z.string().trim().min(1, "Required").max(50),
  rate: z.coerce.number().min(0).max(100).multipleOf(0.01, "Up to 2 decimals"),
});

export const expenseCategorySchema = z.object({
  name: z.string().trim().min(1, "Required").max(50),
});

export type FormState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

/** First error message per field, for showing under inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    out[key] ??= issue.message;
  }
  return out;
}
