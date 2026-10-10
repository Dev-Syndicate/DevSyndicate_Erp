// Document totals (PRD §9.3), mirroring public.recalculate_quotation. The database is the source of
// truth; this runs the same steps in the browser for the live preview. Keep both in sync: the cases in
// money.test.mjs match supabase/tests/quotations_check.sql.
// Exact integer maths (BigInt): amounts in paise, quantities in thousandths, rates/percents in hundredths.
// No path-alias imports: money.test.mjs runs this file directly with `node --test`.

export type DiscountType = "amount" | "percent";
export type SupplyType = "intra" | "inter" | "export";

export type LineInput = {
  quantity: string;
  unitPrice: string;
  discountType: DiscountType;
  discountValue: string;
  taxRate: string;
};

export type DocumentInput = {
  lines: LineInput[];
  discountType: DiscountType;
  discountValue: string;
  supplyType: SupplyType;
  gstApplicable: boolean;
  roundOff: boolean;
};

export type LineTotals = { gross: bigint; discount: bigint; net: bigint; allocated: bigint; taxable: bigint; cgst: bigint; sgst: bigint; igst: bigint; total: bigint };

export type DocumentTotals = {
  lines: LineTotals[];
  subtotal: bigint;
  discount: bigint;
  taxable: bigint;
  cgst: bigint;
  sgst: bigint;
  igst: bigint;
  roundOff: bigint;
  grandTotal: bigint;
  error: string | null;
};

/** Parses a non-negative decimal string into an integer scaled by 10^scale, or null if invalid. */
export function toScaled(value: string, scale: number): bigint | null {
  const m = /^\s*(\d*)(?:\.(\d*))?\s*$/.exec(value);
  if (!m || (!m[1] && !m[2])) return null;
  const frac = (m[2] ?? "").padEnd(scale + 1, "0");
  const base = BigInt((m[1] || "0") + frac.slice(0, scale));
  return frac[scale] >= "5" ? base + 1n : base; // half up, like numeric input casts
}

/** n / d rounded half away from zero (Postgres round()). */
function div(n: bigint, d: bigint): bigint {
  const neg = n < 0n !== d < 0n;
  const a = n < 0n ? -n : n;
  const b = d < 0n ? -d : d;
  const q = (2n * a + b) / (2n * b);
  return neg ? -q : q;
}

export function calculateDocument(doc: DocumentInput): DocumentTotals {
  let error: string | null = null;
  const parsed = doc.lines.map((l) => ({
    qty: toScaled(l.quantity, 3) ?? 0n,
    price: toScaled(l.unitPrice, 2) ?? 0n,
    discountType: l.discountType,
    discountValue: toScaled(l.discountValue || "0", 2) ?? 0n,
    rate: doc.gstApplicable && doc.supplyType !== "export" ? (toScaled(l.taxRate || "0", 2) ?? 0n) : 0n,
  }));

  // 1–3: gross, line discount, net
  const lines = parsed.map((l) => {
    const gross = div(l.qty * l.price, 1000n);
    const discount = l.discountType === "percent" ? div(gross * l.discountValue, 10000n) : l.discountValue;
    if (discount > gross) error = "A line discount is larger than the line amount";
    return { gross, discount, net: gross - discount, rate: l.rate };
  });

  // 4–5: document discount, pro-rata allocation, remainder to the last line with value
  const subtotal = lines.reduce((s, l) => s + l.net, 0n);
  const docValue = toScaled(doc.discountValue || "0", 2) ?? 0n;
  const discount = doc.discountType === "percent" ? div(subtotal * docValue, 10000n) : docValue;
  if (discount > subtotal) error = "The discount is larger than the subtotal";
  const allocated = lines.map((l) => (subtotal === 0n ? 0n : div(discount * l.net, subtotal)));
  const lastIndex = lines.findLastIndex((l) => l.net > 0n);
  if (lastIndex >= 0) allocated[lastIndex] += discount - allocated.reduce((s, a) => s + a, 0n);

  // 6: taxable value and tax split
  const totals: LineTotals[] = lines.map((l, i) => {
    const taxable = l.net - allocated[i];
    const tax = div(taxable * l.rate, 10000n);
    const cgst = doc.supplyType === "intra" ? div(tax, 2n) : 0n;
    return {
      gross: l.gross,
      discount: l.discount,
      net: l.net,
      allocated: allocated[i],
      taxable,
      cgst,
      sgst: doc.supplyType === "intra" ? tax - cgst : 0n,
      igst: doc.supplyType === "inter" ? tax : 0n,
      total: taxable + tax,
    };
  });

  // 7–12: header totals and round-off to the rupee
  const sum = (key: keyof LineTotals) => totals.reduce((s, l) => s + l[key], 0n);
  const exact = sum("taxable") + sum("cgst") + sum("sgst") + sum("igst");
  const grandTotal = doc.roundOff ? div(exact, 100n) * 100n : exact;

  return {
    lines: totals,
    subtotal,
    discount,
    taxable: sum("taxable"),
    cgst: sum("cgst"),
    sgst: sum("sgst"),
    igst: sum("igst"),
    roundOff: grandTotal - exact,
    grandTotal,
    error,
  };
}

/** Rupee amount from the database (2 decimals) → exact paise, for adding amounts without float error. */
export const paise = (rupees: number | string) => BigInt(Math.round(Number(rupees) * 100));

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

/** Formats paise (bigint) or a rupee amount from the database (number/string) as ₹1,25,000.00. */
export function formatINR(value: bigint | number | string): string {
  if (typeof value === "bigint") {
    const neg = value < 0n;
    const abs = neg ? -value : value;
    const rupees = inr.format(Number(abs / 100n)).replace(/\.00$/, "");
    return `${neg ? "-" : ""}${rupees}.${String(abs % 100n).padStart(2, "0")}`;
  }
  return inr.format(Number(value));
}
