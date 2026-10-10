import { Badge } from "@/components/ui/badge";
import type { QuotationStatus } from "@/features/quotations/schema";

// Status colours come from theme tokens (CLAUDE.md rule 2).
const STYLES: Record<QuotationStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "border-border bg-transparent text-muted-foreground" },
  sent: { label: "Sent", className: "bg-info/15 text-info" },
  accepted: { label: "Accepted", className: "bg-success/15 text-success" },
  partially_invoiced: { label: "Partially invoiced", className: "bg-warning/15 text-warning" },
  invoiced: { label: "Invoiced", className: "bg-success/15 text-success" },
  rejected: { label: "Rejected", className: "bg-destructive/15 text-destructive" },
  expired: { label: "Expired", className: "bg-warning/15 text-warning" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
  superseded: { label: "Superseded", className: "bg-muted text-muted-foreground" },
};

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  const { label, className } = STYLES[status];
  return <Badge className={className}>{label}</Badge>;
}
