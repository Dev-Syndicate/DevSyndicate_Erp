import { z } from "zod";
import { GSTIN_RE, optionalCode } from "@/lib/forms";

const text = z.string().trim().max(500);

export const vendorSchema = z.object({
  name: z.string().trim().min(1, "Required").max(200),
  contact_person: text,
  email: z.union([z.literal(""), z.email("Invalid email")]),
  phone: z.string().trim().max(30),
  address: text,
  gstin: optionalCode(GSTIN_RE, "Invalid GSTIN"),
  default_expense_category_id: z.union([z.literal(""), z.uuid()]).transform((v) => v || null),
  notes: z.string().trim().max(5000),
});
