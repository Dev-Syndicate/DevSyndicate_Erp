import assert from "node:assert/strict";
import { test } from "node:test";
import { changes, recordLabel } from "./utils.ts";

test("changes lists only fields that changed, skipping bookkeeping columns", () => {
  const before = { id: "1", status: "draft", number: null, amount: 100, updated_at: "a", notes: "" };
  const after = { id: "1", status: "issued", number: "INV-2026-10-001", amount: 100, updated_at: "b", notes: "" };
  assert.deepEqual(changes(before, after), [
    { field: "Status", from: "draft", to: "issued" },
    { field: "Number", from: "empty", to: "INV-2026-10-001" },
  ]);
});

test("changes is empty for inserts and deletes", () => {
  assert.deepEqual(changes(null, { status: "draft" }), []);
  assert.deepEqual(changes({ status: "draft" }, null), []);
});

test("recordLabel prefers the document number, then names, then a short id", () => {
  assert.equal(recordLabel(null, { number: "EXP/26-27/10/0001", description: "AWS" }, "abc"), "EXP/26-27/10/0001");
  assert.equal(recordLabel({ company_name: "SIPLINK" }, null, "abc"), "SIPLINK");
  assert.equal(recordLabel(null, { amount: 5 }, "1234567890"), "12345678");
});
