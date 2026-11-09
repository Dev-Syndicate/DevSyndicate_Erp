import assert from "node:assert/strict";
import { test } from "node:test";
import { leadSchema, urlDate } from "./schema.ts";

const lead = (fields) => ({
  name: "Asha", company: "", email: "", phone: "", source: "instagram", source_detail: "", status: "new",
  lost_reason: "", lost_note: "", next_follow_up: "", follow_up_note: "", notes: "", ...fields,
});
const errorAt = (fields) => leadSchema.safeParse(lead(fields)).error?.issues.map((i) => i.path[0]);

test("only real dates from the URL become filters", () => {
  assert.equal(urlDate("2026-11-09"), "2026-11-09");
  for (const bad of ["2026-13-45", "2026-02-30", "09-11-2026", "", undefined, ["2026-11-09"]]) assert.equal(urlDate(bad), "");
});

test("an email or phone is enough on any source", () => {
  assert.equal(errorAt({ source: "referral", phone: "98450 12345" }), undefined);
  assert.equal(errorAt({ source: "instagram", email: "a@b.in" }), undefined);
});

test("a handle stands in for contact details only on Instagram and LinkedIn", () => {
  assert.equal(errorAt({ source: "instagram", source_detail: "@raostudio" }), undefined);
  assert.equal(errorAt({ source: "linkedin", source_detail: "linkedin.com/in/asharao" }), undefined);
  assert.deepEqual(errorAt({ source: "referral", source_detail: "Karthik" }), ["phone"]);
});

test("a social lead with nothing asks for the handle; a blank one does not count", () => {
  assert.deepEqual(errorAt({ source: "instagram" }), ["source_detail"]);
  assert.deepEqual(errorAt({ source: "instagram", source_detail: "   " }), ["source_detail"]);
});
