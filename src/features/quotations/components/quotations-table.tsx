import Link from "next/link";
import { FileText } from "lucide-react";
import { EmptyRow } from "@/components/list-controls";
import { StatusTile } from "@/components/status-tile";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { listQuotations } from "@/features/quotations/queries";
import { displayStatus } from "@/features/quotations/schema";
import { formatDate, istToday } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { QuotationStatusBadge, quotationStatusClass } from "./quotation-status-badge";

type Rows = Awaited<ReturnType<typeof listQuotations>>["rows"];

export function quotationLabel(q: { number: string | null; revision: number }) {
  if (!q.number) return "Draft";
  return q.revision > 1 ? `${q.number} (Rev ${q.revision})` : q.number;
}

export function QuotationsTable({ rows }: { rows: Rows }) {
  const today = istToday();
  return (
    <Card className="flex-1">
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead className="w-[30%]">Title</TableHead>
              <TableHead className="w-[22%]">Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Valid until</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="pl-6">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <EmptyRow colSpan={7} icon={FileText} title="No quotations yet" description="Quotations you create appear here. If you searched, try a different title or number." />
            )}
            {rows.map((q) => (
              <TableRow key={q.id}>
                <TableCell className="font-mono text-sm">
                  <div className="flex items-center gap-3">
                    <StatusTile icon={FileText} className={quotationStatusClass(displayStatus(q, today))} />
                    <Link href={`/finance/quotations/${q.id}`} className="hover:underline">
                      {quotationLabel(q)}
                    </Link>
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/finance/quotations/${q.id}`} className="hover:underline">
                    {q.title}
                  </Link>
                </TableCell>
                <TableCell>{q.clients?.company_name}</TableCell>
                <TableCell className="tabular-nums">{formatDate(q.quotation_date)}</TableCell>
                <TableCell className="tabular-nums">{formatDate(q.valid_until)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(q.grand_total)}</TableCell>
                <TableCell className="pl-6">
                  <QuotationStatusBadge status={displayStatus(q, today)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
