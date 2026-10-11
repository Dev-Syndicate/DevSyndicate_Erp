import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OWNER_KINDS } from "@/features/owner/schema";
import { formatDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { methodLabel } from "@/lib/payment-methods";
import type { Tables } from "@/lib/supabase/database.types";

export function OwnerView({ t }: { t: Tables<"owner_transactions"> }) {
  const kind = OWNER_KINDS.find((k) => k.value === t.kind);
  const rows: [string, string][] = [
    ["Date", formatDate(t.txn_date)],
    ["Amount", formatINR(t.amount)],
    ["Method", methodLabel(t.method)],
    ["Reference", t.reference || "—"],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{kind?.label ?? t.kind}</CardTitle>
        <p className="text-sm text-muted-foreground">{kind?.hint} Not an expense: it changes your capital and the company balance.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        {t.notes && <p className="text-sm whitespace-pre-line text-muted-foreground">{t.notes}</p>}
      </CardContent>
    </Card>
  );
}
