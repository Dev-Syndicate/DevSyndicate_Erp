import { z } from "zod";
import { moneyString } from "@/lib/line-items";
import { toScaled } from "@/lib/money";
import { METHODS } from "@/lib/payment-methods";

const paise = (v: string) => toScaled(v || "0", 2) ?? 0n;

export const paymentSchema = z
  .object({
    client_id: z.uuid("Select a client"),
    kind: z.enum(["receipt", "refund"]),
    payment_date: z.iso.date("Pick a date"),
    amount: moneyString,
    tds_amount: moneyString,
    method: z.enum(METHODS.map((m) => m.value)),
    reference: z.string().trim().max(100),
    notes: z.string().trim().max(2000),
    allocations: z.array(
      z.object({ invoice_id: z.uuid(), amount: moneyString.refine((v) => paise(v) > 0n, "Must be more than 0") }),
    ),
  })
  .refine((p) => paise(p.amount) + paise(p.tds_amount) > 0n, { path: ["amount"], message: "Enter the amount received" })
  .refine((p) => p.kind === "receipt" || (paise(p.tds_amount) === 0n && p.allocations.length === 0), {
    path: ["kind"],
    message: "A refund has no invoices or TDS",
  })
  .refine(
    (p) => p.allocations.reduce((s, a) => s + paise(a.amount), 0n) <= paise(p.amount) + paise(p.tds_amount),
    { path: ["allocations"], message: "The invoices add up to more than the amount received plus TDS" },
  );

export type PaymentInput = z.input<typeof paymentSchema>;
export type PaymentStatus = "pending" | "confirmed" | "cancelled";

export const paymentLabel = (p: { number: string | null; status: string }) =>
  p.number ?? (p.status === "cancelled" ? "Cancelled" : "Pending");
