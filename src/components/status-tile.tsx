import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Rounded icon square at the start of a list row, tinted with the record's status badge colours (neutral when it has no status). */
export function StatusTile({ icon: Icon, className = "bg-muted text-muted-foreground" }: { icon: LucideIcon; className?: string }) {
  return (
    <span aria-hidden className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg border border-current/20", className)}>
      <Icon className="size-4" />
    </span>
  );
}
