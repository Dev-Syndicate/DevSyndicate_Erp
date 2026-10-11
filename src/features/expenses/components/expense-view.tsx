import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { getExpense } from "@/features/expenses/queries";
import { formatDate } from "@/lib/dates";
import { formatINR, paise } from "@/lib/money";
import { methodLabel } from "@/lib/payment-methods";

type Expense = NonNullable<Awaited<ReturnType<typeof getExpense>>>;

export function ExpenseView({ e }: { e: Expense }) {
  const details: [string, string][] = [
    ["Date paid", formatDate(e.expense_date)],
    ["Category", e.expense_categories?.name ?? "—"],
    ["Vendor", e.vendors ? [e.vendors.name, e.vendors.gstin && `GSTIN ${e.vendors.gstin}`].filter(Boolean).join(" · ") : "—"],
    ["Vendor bill no.", e.vendor_invoice_number || "—"],
    ["Paid by", methodLabel(e.method)],
    ["Reference", e.reference || "—"],
  ];
  const amounts: [string, string][] = [
    ["Bill total", formatINR(e.amount)],
    ...(e.gst_amount > 0
      ? ([
          [
            e.reverse_charge ? "GST you pay (reverse charge)" : "GST on the bill",
            `${formatINR(e.gst_amount)} · ${e.itc_eligible ? "input tax credit claimed" : "no input tax credit"}`,
          ],
        ] as [string, string][])
      : []),
    ...(e.tds_amount > 0
      ? ([
          ["TDS deducted", formatINR(e.tds_amount)],
          ["Paid to vendor", formatINR(paise(e.amount) - paise(e.tds_amount))],
        ] as [string, string][])
      : []),
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{e.description}</CardTitle>
        </CardHeader>
        <CardContent>
          <List rows={details} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Amount</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <List rows={amounts} />
          {e.notes && <p className="text-sm whitespace-pre-line text-muted-foreground">{e.notes}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function List({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
