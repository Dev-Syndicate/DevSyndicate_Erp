import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { EmptyRow } from "@/components/list-controls";
import { StatusTile } from "@/components/status-tile";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { listCreditNotes } from "@/features/credit-notes/queries";
import { creditNoteLabel, type CreditNoteStatus } from "@/features/credit-notes/schema";
import { formatDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { CreditNoteStatusBadge, creditNoteStatusClass } from "./credit-note-status-badge";

type Rows = Awaited<ReturnType<typeof listCreditNotes>>["rows"];

export function CreditNotesTable({ rows }: { rows: Rows }) {
  return (
    <Card className="flex-1">
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead className="w-[25%]">Client</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead className="w-[25%]">Reason</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="pl-6">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <EmptyRow colSpan={7} icon={ReceiptText} title="No credit notes yet" description="Issue one from an invoice to correct or reduce what the client owes. If you searched, try a different number." />
            )}
            {rows.map((cn) => (
              <TableRow key={cn.id}>
                <TableCell className="font-mono text-sm">
                  <div className="flex items-center gap-3">
                    <StatusTile icon={ReceiptText} className={creditNoteStatusClass(cn.status as CreditNoteStatus)} />
                    <Link href={`/finance/credit-notes/${cn.id}`} className="hover:underline">
                      {creditNoteLabel(cn)}
                    </Link>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{cn.clients?.company_name}</TableCell>
                <TableCell className="font-mono text-sm">
                  {cn.invoices && (
                    <Link href={`/finance/invoices/${cn.invoices.id}`} className="hover:underline">
                      {cn.invoices.number}
                    </Link>
                  )}
                </TableCell>
                <TableCell className="max-w-64 truncate">{cn.reason}</TableCell>
                <TableCell className="tabular-nums">{formatDate(cn.credit_note_date)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(cn.grand_total)}</TableCell>
                <TableCell className="pl-6">
                  <CreditNoteStatusBadge status={cn.status as CreditNoteStatus} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
