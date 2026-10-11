// Ways money moves, shared by payments (in) and expenses (out).

export const METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "upi", label: "UPI" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "credit_card", label: "Credit card" },
  { value: "debit_card", label: "Debit card" },
  { value: "other", label: "Other" },
] as const;

export const methodLabel = (m: string) => METHODS.find((x) => x.value === m)?.label ?? m;

/** What the bank reference is called for each method (asked when confirming); cash has none. */
export function referenceLabel(method: string): { label: string; example: string; hint: string } | null {
  switch (method) {
    case "upi":
      return { label: "UPI transaction ID", example: "412345678901", hint: "12 digits, under the payment in GPay / PhonePe / Paytm or your bank app." };
    case "bank_transfer":
      return { label: "UTR number", example: "SBIN426123456789", hint: "NEFT / RTGS / IMPS reference in your bank statement or the client's confirmation." };
    case "cheque":
      return { label: "Cheque number", example: "000123", hint: "Printed at the bottom of the cheque." };
    case "cash":
      return null;
    default:
      return { label: "Reference", example: "Transaction ID", hint: "Any ID that identifies this payment." };
  }
}
