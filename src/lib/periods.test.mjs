import assert from "node:assert/strict";
import { test } from "node:test";
import { periodRange } from "./periods.ts";

test("financial year runs April to March", () => {
  assert.deepEqual(periodRange("fy", "2026-10-11"), { from: "2026-04-01", to: "2027-03-31" });
  assert.deepEqual(periodRange("fy", "2027-02-15"), { from: "2026-04-01", to: "2027-03-31" });
  assert.deepEqual(periodRange(undefined, "2026-04-01"), { from: "2026-04-01", to: "2027-03-31" });
  assert.deepEqual(periodRange("last_fy", "2026-03-31"), { from: "2024-04-01", to: "2025-03-31" });
});

test("month and quarter", () => {
  assert.deepEqual(periodRange("month", "2028-02-10"), { from: "2028-02-01", to: "2028-02-29" });
  assert.deepEqual(periodRange("quarter", "2026-10-11"), { from: "2026-10-01", to: "2026-12-31" });
  assert.deepEqual(periodRange("quarter", "2027-03-31"), { from: "2027-01-01", to: "2027-03-31" });
});
