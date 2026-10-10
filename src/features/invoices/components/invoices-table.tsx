import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { listInvoices } from "@/features/invoices/queries";
import { displayStatus, invoiceLabel } from "@/features/invoices/schema";
import { formatDate, istToday } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { InvoiceStatusBadge } from "./invoice-status-badge";

type Rows = Awaited<ReturnType<typeof listInvoices>>["rows"];

export function InvoicesTable({ rows }: { rows: Rows }) {
  const today = istToday();
  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No invoices found.
                </TableCell>
              </TableRow>
            )}
            {rows.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-mono text-sm">
                  <Link href={`/finance/invoices/${inv.id}`} className="hover:underline">
                    {invoiceLabel(inv)}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/finance/invoices/${inv.id}`} className="hover:underline">
                    {inv.clients?.company_name}
                  </Link>
                </TableCell>
                <TableCell className="tabular-nums">{formatDate(inv.invoice_date)}</TableCell>
                <TableCell className="tabular-nums">{formatDate(inv.due_date)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(inv.grand_total)}</TableCell>
                <TableCell>
                  <InvoiceStatusBadge status={displayStatus(inv, today)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
