import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus } from "@/features/invoices/schema";

// Status colours come from theme tokens (CLAUDE.md rule 2).
const STYLES: Record<InvoiceStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "border-border bg-transparent text-muted-foreground" },
  issued: { label: "Issued", className: "bg-info/15 text-info" },
  partially_paid: { label: "Partially paid", className: "bg-warning/15 text-warning" },
  paid: { label: "Paid", className: "bg-success/15 text-success" },
  overdue: { label: "Overdue", className: "bg-destructive/15 text-destructive" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

/** Badge colours for a status, reused by the list row icon. */
export const invoiceStatusClass = (status: InvoiceStatus) => STYLES[status].className;

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { label, className } = STYLES[status];
  return <Badge className={className}>{label}</Badge>;
}
