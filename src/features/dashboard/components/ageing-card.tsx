import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardFigures } from "@/features/dashboard/queries";
import { formatINR, paise } from "@/lib/money";

const BUCKETS = [
  { key: "0_30", label: "0–30 days" },
  { key: "31_60", label: "31–60 days" },
  { key: "61_90", label: "61–90 days" },
  { key: "90_plus", label: "Over 90 days" },
] as const;

/** Unpaid invoices by days since the invoice date (due dates are optional, PRD §15). */
export function AgeingCard({ ageing, total }: { ageing: DashboardFigures["ageing"]; total: string }) {
  const sum = paise(total);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Unpaid by age</CardTitle>
        <CardDescription>Days since the invoice date. Chase the older ones first.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {BUCKETS.map((b, i) => {
          const value = paise(ageing[b.key]);
          // Integer percent for the bar width; display only.
          const pct = sum > 0n ? Number((value * 100n) / sum) : 0;
          return (
            <div key={b.key} className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{b.label}</span>
                <span className={i >= 2 && value > 0n ? "font-medium text-destructive tabular-nums" : "font-medium tabular-nums"}>{formatINR(value)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={i >= 2 ? "h-full bg-destructive" : "h-full bg-primary"} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
