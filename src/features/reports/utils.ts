// Report model (PRD §27): every report is a list of tables; the page draws them and the CSV export flattens one.
// Money is paise (bigint) so totals are exact; dates are YYYY-MM-DD.
import { toCsv } from "@/lib/csv";
import { formatDate, istToday } from "@/lib/dates";
import { toRupees } from "@/lib/money";
import { periodRange } from "@/lib/periods";

export const REPORTS = [
  { value: "revenue", label: "Revenue" },
  { value: "expenses", label: "Expenses" },
  { value: "profit", label: "Profit" },
  { value: "outstanding", label: "Outstanding" },
  { value: "sales", label: "Sales register" },
  { value: "tds", label: "TDS" },
  { value: "tax", label: "GST summary" },
] as const;

export type ReportName = (typeof REPORTS)[number]["value"];
export type Cell = string | number | bigint | null;
export type Column = { key: string; label: string; kind?: "money" | "date" | "number" };
export type Row = Record<string, Cell> & { href?: string };
export type ReportTable = { title: string; description?: string; columns: Column[]; rows: Row[]; total?: Row; empty?: string };
export type Report = { tables: ReportTable[]; csv: ReportTable };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-10" → "Oct 2026" */
export const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

/** Σ of the money columns, as a total row labelled in the first column. */
export function totalRow(columns: Column[], rows: Row[]): Row {
  const total: Row = { [columns[0].key]: "Total" };
  for (const c of columns) if (c.kind === "money") total[c.key] = rows.reduce((s, r) => s + ((r[c.key] as bigint | null) ?? 0n), 0n);
  return total;
}

export function tableCsv(table: ReportTable): string {
  const value = (c: Column, v: Cell) =>
    v === null || v === undefined ? "" : c.kind === "money" ? toRupees(v as bigint) : c.kind === "date" ? formatDate(String(v)) : String(v);
  const rows = [...table.rows, ...(table.total ? [table.total] : [])];
  return toCsv([table.columns.map((c) => c.label), ...rows.map((r) => table.columns.map((c) => value(c, r[c.key])))]);
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** URL → report and filters; defaults to Revenue for this financial year. Shared by the page and the CSV export. */
export function parseReportParams(sp: Record<string, string | string[] | undefined>) {
  const name = REPORTS.find((r) => r.value === one(sp.report))?.value ?? "revenue";
  const fy = periodRange("fy", istToday());
  let from = ISO.test(one(sp.from)) ? one(sp.from) : fy.from;
  let to = ISO.test(one(sp.to)) ? one(sp.to) : fy.to;
  if (from > to) [from, to] = [to, from];
  const id = (v: string) => (UUID.test(v) ? v : undefined);
  return { name, from, to, clientId: id(one(sp.client)), categoryId: id(one(sp.category)) };
}
