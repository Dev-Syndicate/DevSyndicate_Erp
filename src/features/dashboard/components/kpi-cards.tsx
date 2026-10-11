import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardFigures } from "@/features/dashboard/queries";
import { formatINR, paise } from "@/lib/money";

type Kpi = { title: string; value: bigint; hint: string; tone?: "destructive" };

// Definitions from PRD §9.2.
export function KpiCards({ f }: { f: DashboardFigures }) {
  const profit = paise(f.revenue) - paise(f.expenses);
  const main: Kpi[] = [
    { title: "Revenue", value: paise(f.revenue), hint: "Payments confirmed, incl. TDS, less refunds" },
    { title: "Expenses", value: paise(f.expenses), hint: "Bills paid in the period" },
    { title: "Net profit", value: profit, hint: "Revenue − expenses (cash basis)", tone: profit < 0n ? "destructive" : undefined },
    {
      title: "Outstanding",
      value: paise(f.outstanding),
      hint:
        f.overdue_count > 0
          ? `${f.outstanding_count} unpaid · ${formatINR(f.overdue)} overdue`
          : `${f.outstanding_count} unpaid invoice${f.outstanding_count === 1 ? "" : "s"} · as of today`,
    },
  ];
  const more: Kpi[] = [
    { title: "Total invoiced", value: paise(f.total_invoiced), hint: "Issued invoices − credit notes" },
    { title: "Client credit", value: paise(f.client_credit), hint: "Advances not yet applied" },
    { title: "Pending payments", value: paise(f.pending_payments), hint: `${f.pending_payments_count} to confirm` },
    { title: "TDS", value: paise(f.tds_receivable), hint: `Receivable · ${formatINR(f.tds_payable)} payable to deposit` },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {main.map((k) => (
          <Card key={k.title}>
            <CardHeader>
              <CardDescription>{k.title}</CardDescription>
              <CardTitle className={k.tone ? "text-2xl text-destructive tabular-nums" : "text-2xl tabular-nums"}>{formatINR(k.value)}</CardTitle>
              <CardDescription className="text-xs">{k.hint}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {more.map((k) => (
          <Card key={k.title} size="sm">
            <CardHeader>
              <CardDescription>{k.title}</CardDescription>
              <CardTitle className="text-lg tabular-nums">{formatINR(k.value)}</CardTitle>
              <CardDescription className="text-xs">{k.hint}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
