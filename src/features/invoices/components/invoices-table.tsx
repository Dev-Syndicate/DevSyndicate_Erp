import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { EmptyRow } from "@/components/list-controls";
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
              <TableHead className="w-[40%]">Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="pl-6">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <EmptyRow colSpan={6} icon={ReceiptText} title="No invoices yet" description="Create an invoice or convert an accepted quotation. If you searched, try a different number." />
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
                <TableCell className="pl-6">
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
