import { z } from "zod";
import { istToday } from "@/lib/dates";
import { moneyString } from "@/lib/line-items";
import { toScaled } from "@/lib/money";
import { METHODS } from "@/lib/payment-methods";

export const OWNER_KINDS = [
  { value: "drawing", label: "Drawing", hint: "Money you took out of the business for yourself." },
  { value: "capital", label: "Capital introduced", hint: "Your own money you put into the business." },
] as const;

export const ownerKindLabel = (k: string) => OWNER_KINDS.find((x) => x.value === k)?.label ?? k;

// Mirrors public.save_owner_transaction (PRD §21.1).
export const ownerTransactionSchema = z.object({
  kind: z.enum(OWNER_KINDS.map((k) => k.value)),
  txn_date: z.iso.date("Pick a date").refine((d) => d <= istToday(), "The date can't be in the future"),
  amount: moneyString.refine((v) => (toScaled(v || "0", 2) ?? 0n) > 0n, "Enter the amount"),
  method: z.enum(METHODS.map((m) => m.value)),
  reference: z.string().trim().max(100),
  notes: z.string().trim().max(2000),
});

export type OwnerTransactionInput = z.input<typeof ownerTransactionSchema>;
