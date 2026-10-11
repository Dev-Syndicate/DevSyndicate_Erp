import assert from "node:assert/strict";
import { test } from "node:test";
import { toCsv } from "./csv.ts";

test("BOM, quoting and CRLF", () => {
  assert.equal(toCsv([["Client", "Amount"], ['Acme, "Pvt" Ltd', "1180.00"]]), '﻿Client,Amount\r\n"Acme, ""Pvt"" Ltd",1180.00\r\n');
});

test("formula-like text is neutralised, negative amounts are not", () => {
  assert.equal(toCsv([["=HYPERLINK(1)", "-1180.00", "@x"]]), "﻿'=HYPERLINK(1),-1180.00,'@x\r\n");
});
