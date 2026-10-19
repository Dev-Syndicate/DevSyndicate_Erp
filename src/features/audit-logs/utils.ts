// Turns raw audit rows (PRD §28: table, record id, before/after JSON) into something a person can read.

type Json = Record<string, unknown> | null;

/** Tables with the audit trigger, as shown in the Module filter. */
export const MODULES: Record<string, string> = {
  clients: "Clients",
  client_contacts: "Client contacts",
  leads: "Leads",
  lead_activities: "Lead activity",
  vendors: "Vendors",
  quotations: "Quotations",
  quotation_items: "Quotation lines",
  invoices: "Invoices",
  invoice_items: "Invoice lines",
  credit_notes: "Credit notes",
  credit_note_items: "Credit note lines",
  payments: "Payments",
  payment_allocations: "Payment allocations",
  expenses: "Expenses",
  owner_transactions: "Owner's account",
  documents: "Files",
  company_settings: "Company settings",
  document_numbering: "Numbering",
  tax_rates: "Tax rates",
  expense_categories: "Expense categories",
  profiles: "Users",
  roles: "Roles",
  role_permissions: "Permissions",
};

export const ACTIONS: Record<string, string> = { insert: "Created", update: "Updated", delete: "Deleted" };

// Bookkeeping columns that change on every save and say nothing to a reader.
const SKIP = new Set(["updated_at", "created_at", "organization_id", "id"]);

/** Best human name for the record: its number, name or description, else a short id. */
export function recordLabel(before: Json, after: Json, recordId: string | null): string {
  const row = after ?? before ?? {};
  for (const key of ["number", "company_name", "name", "full_name", "email", "description", "file_name", "permission", "legal_name"]) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.length > 60 ? `${v.slice(0, 57)}…` : v;
  }
  return recordId ? recordId.slice(0, 8) : "—";
}

/** "snake_case" → "Snake case". */
export const fieldLabel = (key: string) => key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "empty";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
}

/** Fields whose value changed in an update, oldest first; empty for inserts and deletes. */
export function changes(before: Json, after: Json): { field: string; from: string; to: string }[] {
  if (!before || !after) return [];
  return Object.keys(after)
    .filter((k) => !SKIP.has(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .map((k) => ({ field: fieldLabel(k), from: show(before[k]), to: show(after[k]) }));
}
