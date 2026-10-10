// Run: node --test src/features/settings/numbering.test.mjs
// Cases match supabase/tests/document_numbering_check.sql so the preview equals the issued number.
import assert from "node:assert/strict";
import { test } from "node:test";
import { numberingError, renderNumber } from "./numbering.ts";

test("renders like the database", () => {
  assert.equal(renderNumber("INV/{FY}/{SEQ}", 4, 7, new Date(2026, 9, 10)), "INV/26-27/0007");
  assert.equal(renderNumber("INV/{FY}/{SEQ}", 4, 7, new Date(2027, 2, 31)), "INV/26-27/0007");
  assert.equal(renderNumber("DS{YYYY}{MM}-{SEQ}", 3, 12345, new Date(2026, 3, 1)), "DS202604-12345");
  assert.equal(renderNumber("Q{YY}-{SEQ}", 1, 5, new Date(2026, 0, 15)), "Q26-5");
});

test("validates formats like the database", () => {
  assert.equal(numberingError("invoice", "DS-{FY}-{SEQ}", 3, "financial_year"), null);
  assert.match(numberingError("invoice", "DS-INVOICE-{FY}-{SEQ}", 4, "financial_year"), /16 characters/);
  assert.match(numberingError("quotation", "Q-{SEQ}", 4, "financial_year"), /\{FY\}/);
  assert.match(numberingError("quotation", "Q-{YYYY}", 4, "never"), /\{SEQ\}/);
  assert.match(numberingError("quotation", "q-{SEQ}", 4, "never"), /A–Z/);
  assert.equal(numberingError("expense", "EXP-{SEQ}", 5, "never"), null);
  assert.equal(numberingError("quotation", "Q{YY}{MM}-{SEQ}", 3, "monthly"), null);
  assert.match(numberingError("quotation", "Q{YYYY}-{SEQ}", 3, "monthly"), /\{MM\}/);
});
