import { z } from "zod";
import { istToday } from "@/lib/dates";
import { moneyString } from "@/lib/line-items";
import { toScaled } from "@/lib/money";
import { METHODS } from "@/lib/payment-methods";

const paise = (v: string) => toScaled(v || "0", 2) ?? 0n;

// Mirrors public.save_expense (PRD §21).
export const expenseSchema = z
  .object({
    expense_date: z.iso.date("Pick a date").refine((d) => d <= istToday(), "The date can't be in the future"),
    category_id: z.uuid("Select a category"),
    vendor_id: z.union([z.literal(""), z.uuid()]),
    description: z.string().trim().min(1, "Enter a description").max(500),
    vendor_invoice_number: z.string().trim().max(50),
    amount: moneyString.refine((v) => paise(v) > 0n, "Enter the amount paid"),
    gst_amount: moneyString,
    itc_eligible: z.boolean(),
    reverse_charge: z.boolean(),
    tds_amount: moneyString,
    method: z.enum(METHODS.map((m) => m.value)),
    reference: z.string().trim().max(100),
    notes: z.string().trim().max(2000),
  })
  .refine((e) => e.reverse_charge || paise(e.gst_amount) < paise(e.amount), { path: ["gst_amount"], message: "GST must be less than the total amount" })
  .refine((e) => paise(e.tds_amount) < paise(e.amount), { path: ["tds_amount"], message: "TDS must be less than the amount" });

export type ExpenseInput = z.input<typeof expenseSchema>;
