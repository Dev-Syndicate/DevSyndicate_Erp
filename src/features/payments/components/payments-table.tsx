import Link from "next/link";
import { IndianRupee } from "lucide-react";
import { EmptyRow } from "@/components/list-controls";
import { StatusTile } from "@/components/status-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { listPayments } from "@/features/payments/queries";
import { paymentLabel, type PaymentStatus } from "@/features/payments/schema";
import { methodLabel } from "@/lib/payment-methods";
import { formatDate } from "@/lib/dates";
import { formatINR, paise } from "@/lib/money";
import { PaymentStatusBadge, paymentStatusClass } from "./payment-status-badge";

type Rows = Awaited<ReturnType<typeof listPayments>>["rows"];

export function PaymentsTable({ rows }: { rows: Rows }) {
  return (
    <Card className="flex-1">
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receipt</TableHead>
              <TableHead className="w-[35%]">Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Credit left</TableHead>
              <TableHead className="pl-6">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <EmptyRow colSpan={7} icon={IndianRupee} title="No payments yet" description="Payments you record appear here. If you searched, try a different receipt number." />
            )}
            {rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-sm">
                  <div className="flex items-center gap-3">
                    <StatusTile icon={IndianRupee} className={paymentStatusClass(p.status as PaymentStatus)} />
                    <Link href={`/finance/payments/${p.id}`} className="hover:underline">
                      {paymentLabel(p)}
                    </Link>
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/finance/payments/${p.id}`} className="hover:underline">
                    {p.clients?.company_name}
                  </Link>
                  {p.kind === "refund" && (
                    <Badge variant="outline" className="ml-2">
                      Refund
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{formatDate(p.payment_date)}</TableCell>
                <TableCell>{methodLabel(p.method)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatINR(p.kind === "refund" ? -paise(p.amount) : paise(p.amount) + paise(p.tds_amount))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.kind === "receipt" && p.status === "confirmed" ? formatINR(p.unallocated ?? 0) : "—"}
                </TableCell>
                <TableCell className="pl-6">
                  <PaymentStatusBadge status={p.status as PaymentStatus} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
