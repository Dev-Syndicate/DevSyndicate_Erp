import Link from "next/link";
import { ConfirmButton } from "@/components/confirm-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { unapplyPayment } from "@/features/payments/actions";
import type { getPayment } from "@/features/payments/queries";
import { methodLabel } from "@/features/payments/schema";
import { formatDate } from "@/lib/dates";
import { formatINR, paise } from "@/lib/money";

type Payment = NonNullable<Awaited<ReturnType<typeof getPayment>>>;

export function PaymentView({ p, canUnapply }: { p: Payment; canUnapply: boolean }) {
  const receipt = p.kind === "receipt";
  const rows: [string, string][] = [
    ["Date", formatDate(p.payment_date)],
    ["Method", methodLabel(p.method)],
    ["Reference", p.reference || "—"],
    [receipt ? "Amount received" : "Amount refunded", formatINR(p.amount)],
    ...(receipt && p.tds_amount > 0 ? ([["TDS deducted", formatINR(p.tds_amount)]] as [string, string][]) : []),
    ...(receipt ? ([["Total settled", formatINR(paise(p.amount) + paise(p.tds_amount))]] as [string, string][]) : []),
    ...(receipt ? ([["Not applied (client credit)", formatINR(p.unallocated ?? 0)]] as [string, string][]) : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{receipt ? "Received from" : "Refunded to"}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {p.clients && (
              <Link href={`/clients/${p.clients.id}`} className="font-medium hover:underline">
                {p.clients.company_name}
              </Link>
            )}
            <span className="text-muted-foreground">
              {[p.clients?.billing_address, p.clients?.city, p.clients?.state].filter(Boolean).join(", ")}
            </span>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      {p.cancel_reason && (
        <p className="text-sm text-muted-foreground">
          Cancelled. Reason: <span className="text-foreground">{p.cancel_reason}</span>
        </p>
      )}

      {receipt && (
        <Card>
          <CardHeader>
            <CardTitle>Applied to invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {p.payment_allocations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not applied to any invoice. The full amount is client credit (an advance).</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Invoice total</TableHead>
                    <TableHead className="text-right">Applied</TableHead>
                    {canUnapply && <TableHead className="w-24" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.payment_allocations.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-sm">
                        {a.invoices && (
                          <Link href={`/finance/invoices/${a.invoices.id}`} className="hover:underline">
                            {a.invoices.number}
                          </Link>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">{formatDate(a.invoices?.invoice_date)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(a.invoices?.grand_total ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(a.amount)}</TableCell>
                      {canUnapply && (
                        <TableCell>
                          <ConfirmButton
                            action={unapplyPayment.bind(null, p.id, a.id)}
                            title="Remove from this invoice?"
                            description="The amount goes back to client credit and the invoice balance goes up."
                            confirmLabel="Remove"
                            successMessage="Removed from invoice"
                            variant="ghost"
                            size="sm"
                          >
                            Remove
                          </ConfirmButton>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {p.notes && <p className="text-sm whitespace-pre-line text-muted-foreground">{p.notes}</p>}
    </div>
  );
}
