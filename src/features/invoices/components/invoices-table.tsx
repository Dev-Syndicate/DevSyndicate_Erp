import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { EmptyRow } from "@/components/list-controls";
import { StatusTile } from "@/components/status-tile";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { listInvoices } from "@/features/invoices/queries";
import { displayStatus, invoiceLabel } from "@/features/invoices/schema";
import { formatDate, istToday } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { InvoiceStatusBadge, invoiceStatusClass } from "./invoice-status-badge";

type Rows = Awaited<ReturnType<typeof listInvoices>>["rows"];

export function InvoicesTable({ rows }: { rows: Rows }) {
  const today = istToday();
  return (
    <Card className="flex-1">
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead className="w-[40%]">Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="pl-6">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <EmptyRow colSpan={7} icon={ReceiptText} title="No invoices yet" description="Create an invoice or convert an accepted quotation. If you searched, try a different number." />
            )}
            {rows.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-mono text-sm">
                  <div className="flex items-center gap-3">
                    <StatusTile icon={ReceiptText} className={invoiceStatusClass(displayStatus(inv, today))} />
                    <Link href={`/finance/invoices/${inv.id}`} className="hover:underline">
                      {invoiceLabel(inv)}
                    </Link>
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/finance/invoices/${inv.id}`} className="hover:underline">
                    {inv.clients?.company_name}
                  </Link>
                </TableCell>
                <TableCell className="tabular-nums">{formatDate(inv.invoice_date)}</TableCell>
                <TableCell className="tabular-nums">{formatDate(inv.due_date)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(inv.grand_total)}</TableCell>
                <TableCell className="text-right tabular-nums">{inv.status === "issued" ? formatINR(inv.balance_due ?? 0) : "—"}</TableCell>
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
