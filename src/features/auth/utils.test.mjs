import assert from "node:assert/strict";
import { test } from "node:test";
import { safeNext } from "./utils.ts";

test("after sign-in, only same-site paths are followed", () => {
  assert.equal(safeNext("/oauth/consent?authorization_id=abc"), "/oauth/consent?authorization_id=abc");
  assert.equal(safeNext("/leads"), "/leads");
  for (const bad of ["", "https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "leads"]) {
    assert.equal(safeNext(bad), "/", bad);
  }
});
