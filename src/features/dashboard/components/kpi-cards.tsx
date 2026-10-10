import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Definitions from PRD §9.2. Values are wired up once payments/expenses exist.
const kpis = [
  { title: "Revenue", hint: "Confirmed receipts − refunds" },
  { title: "Expenses", hint: "All money spent" },
  { title: "Net Cash Position", hint: "Revenue − expenses" },
  { title: "Outstanding", hint: "Balance of issued invoices" },
];

export function KpiCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.title}>
          <CardHeader>
            <CardDescription>{kpi.title}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">—</CardTitle>
            <CardDescription className="text-xs">{kpi.hint}</CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
