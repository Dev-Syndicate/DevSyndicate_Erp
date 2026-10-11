import { Badge } from "@/components/ui/badge";
import type { CreditNoteStatus } from "@/features/credit-notes/schema";

// Status colours come from theme tokens (CLAUDE.md rule 2).
const STYLES: Record<CreditNoteStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "border-border bg-transparent text-muted-foreground" },
  issued: { label: "Issued", className: "bg-info/15 text-info" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

/** Badge colours for a status, reused by the list row icon. */
export const creditNoteStatusClass = (status: CreditNoteStatus) => STYLES[status].className;

export function CreditNoteStatusBadge({ status }: { status: CreditNoteStatus }) {
  const { label, className } = STYLES[status];
  return <Badge className={className}>{label}</Badge>;
}
