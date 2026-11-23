import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanHtml } from "./html.ts";
import { SLUG_RE, slugify } from "./utils.ts";

test("slugs are lowercase words joined by dashes", () => {
  assert.equal(slugify("Tailwind CSS v5 — What's New?"), "tailwind-css-v5-whats-new");
  assert.equal(slugify("  Café   Déjà vu  "), "cafe-deja-vu");
  assert.equal(slugify("हिंदी"), "");
  assert.ok(SLUG_RE.test(slugify("a".repeat(99) + " b")), "trimmed to 100 without a trailing dash");
});

test("cleaned HTML keeps structure and drops styles and scripts", () => {
  assert.equal(cleanHtml('<h2 style="color:red" class="x">Hi</h2><script>alert(1)</script>'), "<h2>Hi</h2>");
  assert.equal(cleanHtml('<p onclick="x()">A <a href="javascript:alert(1)">b</a></p>'), "<p>A <a>b</a></p>");
  assert.equal(cleanHtml('<a href="https://tailwindcss.com" target="_blank" rel="noopener">t</a>'), '<a href="https://tailwindcss.com" target="_blank" rel="noopener">t</a>');
  assert.equal(cleanHtml('<img src="x" onerror="alert(1)"><iframe src="y"></iframe>'), "");
  assert.equal(cleanHtml("<p></p>"), "");
});
