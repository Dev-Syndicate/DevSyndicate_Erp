import { Badge } from "@/components/ui/badge";
import { statusLabel, type LeadStatus } from "@/features/leads/schema";

// Status colours come from theme tokens (CLAUDE.md rule 2).
const STYLES: Record<LeadStatus, string> = {
  new: "bg-info/15 text-info",
  contacted: "bg-warning/15 text-warning",
  qualified: "bg-primary/10 text-primary",
  lost: "bg-muted text-muted-foreground",
  won: "bg-success/15 text-success",
};

/** Badge colours for a status, reused by the list row icon. */
export const leadStatusClass = (status: string) => STYLES[status as LeadStatus];

export function LeadStatusBadge({ status }: { status: string }) {
  return <Badge className={STYLES[status as LeadStatus]}>{statusLabel(status)}</Badge>;
}
