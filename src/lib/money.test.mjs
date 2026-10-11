// Run: pnpm test. Cases match supabase/tests/quotations_check.sql (the database is the source of truth).
import assert from "node:assert/strict";
import { test } from "node:test";
import { amountInWords, calculateDocument, formatINR, gstInside, paise, toRupees, toScaled } from "./money.ts";

const lines = [
  { quantity: "1", unitPrice: "25000", discountType: "percent", discountValue: "10", taxRate: "18" },
  { quantity: "12", unitPrice: "499.99", discountType: "amount", discountValue: "0", taxRate: "18" },
];
const doc = (supplyType) =>
  calculateDocument({ lines, discountType: "amount", discountValue: "1000", supplyType, gstApplicable: true, roundOff: true });

test("intra-state: CGST + SGST and round-off", () => {
  const t = doc("intra");
  assert.equal(t.subtotal, 2849988n);
  assert.equal(t.discount, 100000n);
  assert.equal(t.taxable, 2749988n);
  assert.equal(t.cgst, 247499n);
  assert.equal(t.sgst, 247498n);
  assert.equal(t.roundOff, 15n);
  assert.equal(t.grandTotal, 3245000n);
  assert.equal(t.lines[0].allocated, 78948n);
  assert.equal(t.error, null);
});

test("inter-state: IGST", () => {
  const t = doc("inter");
  assert.equal(t.igst, 494997n);
  assert.equal(t.cgst, 0n);
  assert.equal(t.grandTotal, 3245000n);
});

test("export: zero-rated", () => {
  const t = doc("export");
  assert.equal(t.igst, 0n);
  assert.equal(t.grandTotal, 2750000n);
  assert.equal(t.roundOff, 12n);
});

test("document discount remainder goes to the last line", () => {
  const t = calculateDocument({
    lines: ["100", "100", "100"].map((p) => ({ quantity: "1", unitPrice: p, discountType: "amount", discountValue: "0", taxRate: "0" })),
    discountType: "amount",
    discountValue: "100",
    supplyType: "intra",
    gstApplicable: true,
    roundOff: false,
  });
  assert.deepEqual(t.lines.map((l) => l.allocated), [3333n, 3333n, 3334n]);
});

test("errors and parsing", () => {
  const t = calculateDocument({ lines, discountType: "amount", discountValue: "999999", supplyType: "intra", gstApplicable: true, roundOff: false });
  assert.match(t.error, /larger than the subtotal/);
  assert.equal(toScaled("1.005", 2), 101n);
  assert.equal(toScaled("abc", 2), null);
  assert.equal(formatINR(3245000n), "₹32,450.00");
  assert.equal(formatINR(12345678901n), "₹12,34,56,789.01");
  assert.equal(paise(2474.99) + paise("2474.98"), 494997n);
  assert.equal(paise(-0.15), -15n);
  assert.equal(paise(0.1), 10n);
});

test("amount in words (Indian grouping)", () => {
  assert.equal(amountInWords(1500000n), "Rupees Fifteen Thousand Only");
  assert.equal(amountInWords(3245000n), "Rupees Thirty Two Thousand Four Hundred Fifty Only");
  assert.equal(amountInWords(12345678901n), "Rupees Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine and One Paise Only");
  assert.equal(amountInWords(10000000000n), "Rupees Ten Crore Only");
  assert.equal(amountInWords(10050n), "Rupees One Hundred and Fifty Paise Only");
  assert.equal(amountInWords(0n), "Rupees Zero Only");
});

test("GST inside an inclusive amount (receipt vouchers)", () => {
  assert.deepEqual(gstInside(1180000n, 1800n), { taxable: 1000000n, tax: 180000n });
  assert.deepEqual(gstInside(1000000n, 1800n), { taxable: 847458n, tax: 152542n }); // ₹10,000 → ₹8,474.58 + ₹1,525.42
  assert.deepEqual(gstInside(500n, 0n), { taxable: 500n, tax: 0n });
});

test("plain rupees for CSV", () => {
  assert.equal(toRupees(118050n), "1180.50");
  assert.equal(toRupees(-5n), "-0.05");
  assert.equal(toRupees(0n), "0.00");
});
