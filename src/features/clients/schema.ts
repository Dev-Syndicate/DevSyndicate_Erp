import { z } from "zod";
import { GSTIN_RE, optionalCode, PIN_RE } from "@/lib/forms";
import { INDIAN_STATES } from "@/lib/india";

const text = z.string().trim().max(500);

export const clientSchema = z
  .object({
    company_name: z.string().trim().min(1, "Required").max(200),
    billing_address: text,
    city: text,
    state: z.string().trim().max(100),
    country: z.string().trim().min(1, "Required").max(100),
    pin_code: z.string().trim().max(20),
    gstin: optionalCode(GSTIN_RE, "Invalid GSTIN"),
    payment_terms_days: z
      .union([z.literal(""), z.coerce.number().int().min(0).max(365)])
      .transform((v) => (v === "" ? null : v)),
    notes: z.string().trim().max(5000),
  })
  .refine((c) => c.country !== "India" || c.pin_code === "" || PIN_RE.test(c.pin_code), {
    path: ["pin_code"],
    message: "6-digit PIN code",
  })
  .refine((c) => c.country !== "India" || c.state === "" || INDIAN_STATES.some((s) => s.name === c.state), {
    path: ["state"],
    message: "Select a state",
  })
  .refine((c) => !c.gstin || !c.state || c.gstin.startsWith(INDIAN_STATES.find((s) => s.name === c.state)?.code ?? "--"), {
    path: ["gstin"],
    message: "GSTIN state code does not match the state",
  });

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Required").max(200),
  designation: text,
  email: z.union([z.literal(""), z.email("Invalid email")]),
  phone: z.string().trim().max(30),
  is_primary: z.boolean(),
});
