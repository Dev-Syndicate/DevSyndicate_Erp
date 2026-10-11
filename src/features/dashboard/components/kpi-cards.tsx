import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardFigures } from "@/features/dashboard/queries";
import { formatDate } from "@/lib/dates";
import { formatINR, paise } from "@/lib/money";

type Kpi = { title: string; value: bigint; hint: string; tone?: "destructive" };

// Definitions from PRD §9.2.
export function KpiCards({ f }: { f: DashboardFigures }) {
  const profit = paise(f.revenue) - paise(f.expenses);
  const outstanding: Kpi = {
    title: "Outstanding",
    value: paise(f.outstanding),
    hint:
      f.overdue_count > 0
        ? `${f.outstanding_count} unpaid · ${formatINR(f.overdue)} overdue`
        : `${f.outstanding_count} unpaid invoice${f.outstanding_count === 1 ? "" : "s"} · as of today`,
  };
  // Company balance and drawings need owner.view (PRD §21.1); without it the figures are null.
  const balance: Kpi | null =
    f.balance === null
      ? null
      : {
          title: "Company balance",
          value: paise(f.balance),
          hint: `Money in − money out − drawings, since ${formatDate(f.opening_balance_date)}`,
          tone: paise(f.balance) < 0n ? "destructive" : undefined,
        };
  const main: Kpi[] = [
    { title: "Revenue", value: paise(f.revenue), hint: "Payments confirmed, incl. TDS, less refunds" },
    { title: "Expenses", value: paise(f.expenses), hint: "Bills paid in the period" },
    { title: "Net profit", value: profit, hint: "Revenue − expenses (cash basis)", tone: profit < 0n ? "destructive" : undefined },
    balance ?? outstanding,
  ];
  const more: Kpi[] = [
    ...(balance ? [outstanding] : []),
    { title: "Total invoiced", value: paise(f.total_invoiced), hint: "Issued invoices − credit notes" },
    { title: "Client credit", value: paise(f.client_credit), hint: "Advances not yet applied" },
    { title: "Pending payments", value: paise(f.pending_payments), hint: `${f.pending_payments_count} to confirm` },
    { title: "TDS", value: paise(f.tds_receivable), hint: `Receivable · ${formatINR(f.tds_payable)} payable to deposit` },
    ...(f.drawings !== null
      ? [{ title: "Drawings", value: paise(f.drawings), hint: `Taken by the owner · ${formatINR(f.capital ?? "0")} capital put in` }]
      : []),
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
      <div className={more.length > 4 ? "grid gap-4 sm:grid-cols-3 xl:grid-cols-6" : "grid gap-4 sm:grid-cols-2 xl:grid-cols-4"}>
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
