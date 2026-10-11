import Link from "next/link";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { getDashboardLists, getRecentQuotations } from "@/features/dashboard/queries";
import { formatDate, istToday } from "@/lib/dates";
import { formatINR, paise } from "@/lib/money";

type Lists = Awaited<ReturnType<typeof getDashboardLists>>;
type Row = { id: string; href: string; title: string; sub: string; amount: string; tone?: "destructive" };

function ListCard({ title, href, rows, empty }: { title: string; href: string; rows: Row[]; empty: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link href={href}>View all</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <Table>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-0">
                    <Link href={r.href} className="font-medium hover:underline">
                      {r.title}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{r.sub}</span>
                  </TableCell>
                  <TableCell className={r.tone ? "pr-0 text-right text-destructive tabular-nums" : "pr-0 text-right tabular-nums"}>{r.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

export function DashboardLists({ lists }: { lists: Lists }) {
  const today = istToday();
  const payment = (p: Lists["recent"][number], pending: boolean): Row => ({
    id: p.id,
    href: `/finance/payments/${p.id}`,
    title: p.clients?.company_name ?? "—",
    sub: `${pending ? "Recorded" : p.number} · ${formatDate(p.payment_date)}`,
    amount: formatINR(paise(p.amount) + paise(p.tds_amount)),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <ListCard
        title="Oldest unpaid invoices"
        href="/finance/invoices"
        empty="Nothing unpaid."
        rows={lists.unpaid.map((i) => {
          const age = days(i.invoice_date, today);
          return {
            id: i.id,
            href: `/finance/invoices/${i.id}`,
            title: `${i.number} · ${i.clients?.company_name ?? ""}`,
            sub: `${formatDate(i.invoice_date)} · ${age} day${age === 1 ? "" : "s"} old`,
            amount: formatINR(i.balance_due ?? 0),
            tone: age > 60 ? "destructive" : undefined,
          };
        })}
      />
      <ListCard title="Pending payments" href="/finance/payments" empty="No payments waiting to be confirmed." rows={lists.pending.map((p) => payment(p, true))} />
      <ListCard title="Recent payments" href="/finance/payments" empty="No payments yet." rows={lists.recent.map((p) => payment(p, false))} />
    </div>
  );
}

export function RecentQuotations({ rows }: { rows: Awaited<ReturnType<typeof getRecentQuotations>> }) {
  return (
    <div className="lg:max-w-xl">
      <ListCard
        title="Recent quotations"
        href="/finance/quotations"
        empty="No quotations yet."
        rows={rows.map((q) => ({
          id: q.id,
          href: `/finance/quotations/${q.id}`,
          title: q.title || q.clients?.company_name || "Quotation",
          sub: `${q.number ?? "Draft"}${q.revision > 1 ? ` (Rev ${q.revision})` : ""} · ${q.clients?.company_name ?? ""}`,
          amount: q.status.charAt(0).toUpperCase() + q.status.slice(1),
        }))}
      />
    </div>
  );
}
