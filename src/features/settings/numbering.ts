// Mirrors public.render_document_number / document_numbering CHECKs (migration 20261010142551).
// No path-alias imports: numbering.test.mjs runs this file directly with `node --test`.

export const DOC_TYPES = [
  { type: "quotation", label: "Quotation" },
  { type: "invoice", label: "Invoice" },
  { type: "credit_note", label: "Credit note" },
  { type: "receipt", label: "Payment receipt" },
  { type: "expense", label: "Expense" },
] as const;

export type DocType = (typeof DOC_TYPES)[number]["type"];
export type Reset = "financial_year" | "calendar_year" | "monthly" | "never";

export const RESETS: { value: Reset; label: string }[] = [
  { value: "financial_year", label: "Every financial year" },
  { value: "calendar_year", label: "Every calendar year" },
  { value: "monthly", label: "Every month" },
  { value: "never", label: "Never" },
];

export const TOKENS = [
  { token: "{FY}", meaning: "Financial year, e.g. 26-27" },
  { token: "{YYYY}", meaning: "Year, e.g. 2026" },
  { token: "{YY}", meaning: "Short year, e.g. 26" },
  { token: "{MM}", meaning: "Month, e.g. 04" },
  { token: "{SEQ}", meaning: "Running number" },
] as const;

/** GST: invoice and credit note numbers must fit in 16 characters (PRD §15). */
const GST_LIMITED: DocType[] = ["invoice", "credit_note"];

const pad2 = (n: number) => String(n % 100).padStart(2, "0");

export function renderNumber(pattern: string, padding: number, seq: number, date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const fy = month >= 4 ? year : year - 1;
  return pattern
    .replaceAll("{FY}", `${pad2(fy)}-${pad2(fy + 1)}`)
    .replaceAll("{YYYY}", String(year))
    .replaceAll("{YY}", pad2(year))
    .replaceAll("{MM}", String(month).padStart(2, "0"))
    .replaceAll("{SEQ}", String(seq).padStart(padding, "0"));
}

/** Returns an error message, or null when the format is valid. */
export function numberingError(docType: DocType, pattern: string, padding: number, reset: Reset): string | null {
  if (!pattern) return "Enter a format";
  if (pattern.length > 30) return "Keep the format under 30 characters";
  if (!/^([A-Z0-9/_.-]|\{(FY|YYYY|YY|MM|SEQ)\})+$/.test(pattern)) {
    return "Use A–Z, 0–9, / - _ . and the tokens below";
  }
  if (pattern.split("{SEQ}").length !== 2) return "Include {SEQ} exactly once";
  // A yearly reset without the matching year in the number would repeat numbers.
  if (reset === "financial_year" && !pattern.includes("{FY}")) {
    return pattern.includes("{YY")
      ? "Financial years run April–March, so use {FY} here, or set Resets to Every calendar year"
      : "Resets every financial year, so add {FY} (e.g. 26-27) to keep numbers unique";
  }
  if (reset === "calendar_year" && !pattern.includes("{YYYY}") && !pattern.includes("{YY}")) {
    return "Resets every calendar year, so add {YYYY} or {YY} to keep numbers unique";
  }
  if (reset === "monthly" && (!pattern.includes("{MM}") || !/\{(YYYY|YY|FY)\}/.test(pattern))) {
    return "Resets every month, so add {MM} and a year ({YYYY}, {YY} or {FY}) to keep numbers unique";
  }
  if (GST_LIMITED.includes(docType)) {
    const longest = renderNumber(pattern, padding, 10 ** padding - 1, new Date(2026, 3, 1)).length;
    if (longest > 16) return `GST allows 16 characters; this can reach ${longest}`;
  }
  return null;
}
