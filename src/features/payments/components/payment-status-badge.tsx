import { Badge } from "@/components/ui/badge";
import type { PaymentStatus } from "@/features/payments/schema";

// Status colours come from theme tokens (CLAUDE.md rule 2).
const STYLES: Record<PaymentStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-warning/15 text-warning" },
  confirmed: { label: "Confirmed", className: "bg-success/15 text-success" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { label, className } = STYLES[status];
  return <Badge className={className}>{label}</Badge>;
}
