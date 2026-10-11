// CSV for accountants (PRD §27): UTF-8 with a BOM so Excel shows ₹ and names correctly, RFC 4180 quoting,
// CRLF line ends. Text that Excel would run as a formula (=, +, -, @) gets a leading apostrophe; plain numbers don't.

const NUMBER = /^-?\d+(\.\d+)?$/;

function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) && !NUMBER.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(rows: string[][]): string {
  return `﻿${rows.map((r) => r.map(cell).join(",")).join("\r\n")}\r\n`;
}
