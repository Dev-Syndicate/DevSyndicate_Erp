import { CircleAlert, CircleCheck, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getLastBackup } from "@/features/settings/queries";

const when = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Top-bar indicator for the nightly backup (PRD §34): green within a day, amber when older, red when the last run failed. */
export async function BackupStatus() {
  const b = await getLastBackup().catch(() => null);
  if (!b) return null;
  const hours = b.ageHours;
  const at = when.format(new Date(b.finished_at));
  const state =
    b.status !== "success"
      ? { label: "Backup failed", className: "bg-destructive/15 text-destructive", icon: CircleAlert, tip: `The backup at ${at} failed. Open the run on GitHub to see why.` }
      : hours > 26
        ? { label: `Backup ${Math.floor(hours / 24)} day${hours >= 48 ? "s" : ""} old`, className: "bg-warning/15 text-warning", icon: Clock, tip: `Last successful backup ${at}. Tonight's run should replace it; check GitHub Actions if this stays.` }
        : { label: "Backed up", className: "bg-success/15 text-success", icon: CircleCheck, tip: `Backed up to Google Drive at ${at} · ${Math.ceil(b.size_bytes / 1024)} KB · ${b.files} file${b.files === 1 ? "" : "s"}` };
  const Icon = state.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge asChild className={state.className}>
          <a href={b.run_url || undefined} target="_blank" rel="noreferrer">
            <Icon aria-hidden /> {state.label}
          </a>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{state.tip}</TooltipContent>
    </Tooltip>
  );
}
