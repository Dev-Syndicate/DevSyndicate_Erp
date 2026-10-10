import { z } from "zod";
import { GSTIN_RE, optionalCode, PIN_RE } from "@/lib/forms";
import { INDIAN_STATES } from "@/lib/india";
import { DOC_TYPES, numberingError } from "./numbering";

const text = z.string().trim().max(500);

export const companySettingsSchema = z
  .object({
    legal_name: z.string().trim().min(1, "Required").max(200),
    trade_name: text,
    address: text,
    city: text,
    state: z.union([z.literal(""), z.enum(INDIAN_STATES.map((s) => s.name))]),
    pin_code: z.string().trim().refine((v) => v === "" || PIN_RE.test(v), "6-digit PIN code"),
    email: z.union([z.literal(""), z.email("Invalid email")]),
    phone: text,
    website: text,

    gst_registered: z.boolean(),
    show_sac: z.boolean(),
    gstin: optionalCode(GSTIN_RE, "Invalid GSTIN"),
    default_sac_code: z.string().trim().regex(/^[0-9]{4,8}$/, "4–8 digits"),
    default_tax_rate_id: z.union([z.literal(""), z.uuid()]).transform((v) => v || null),
    lut_number: text,
    lut_valid_until: z.union([z.literal(""), z.iso.date()]).transform((v) => v || null),

    bank_name: text,
    bank_account_name: text,
    bank_account_number: z.string().trim().refine((v) => v === "" || /^[0-9]{6,18}$/.test(v), "6–18 digits"),
    bank_ifsc: optionalCode(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC"),
    upi_id: z.string().trim().refine((v) => v === "" || /^[\w.-]+@[\w]+$/.test(v), "Invalid UPI ID"),

    quotation_validity_days: z.coerce.number().int().min(1).max(365),
    payment_terms_days: z.coerce.number().int().min(0).max(365),
    quotation_terms: z.string().trim().max(5000),
    invoice_terms: z.string().trim().max(5000),
    round_off: z.boolean(),
    signatory_name: text,
    signatory_designation: z.string().trim().max(100),
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

/** One document type's numbering, from form fields named num_<doc type>_<field>. */
export const numberingSchema = z.array(
  z
    .object({
      doc_type: z.enum(DOC_TYPES.map((d) => d.type)),
      pattern: z.string().trim().toUpperCase(),
      padding: z.coerce.number().int().min(1).max(8),
      reset: z.enum(["financial_year", "calendar_year", "monthly", "never"]),
      next_value: z.coerce.number().int().min(1, "Must be at least 1").max(99_999_999),
    })
    .superRefine((n, ctx) => {
      const message = numberingError(n.doc_type, n.pattern, n.padding, n.reset);
      if (message) ctx.addIssue({ code: "custom", path: ["pattern"], message });
    }),
);

export function numberingFromForm(formData: FormData) {
  return DOC_TYPES.map(({ type }) => ({
    doc_type: type,
    pattern: formData.get(`num_${type}_pattern`) ?? "",
    padding: formData.get(`num_${type}_padding`) ?? "",
    reset: formData.get(`num_${type}_reset`) ?? "",
    next_value: formData.get(`num_${type}_next`) ?? "",
  }));
}
