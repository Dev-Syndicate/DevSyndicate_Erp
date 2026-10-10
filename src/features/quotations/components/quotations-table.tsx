import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { listQuotations } from "@/features/quotations/queries";
import { displayStatus } from "@/features/quotations/schema";
import { formatDate, istToday } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { QuotationStatusBadge } from "./quotation-status-badge";

type Rows = Awaited<ReturnType<typeof listQuotations>>["rows"];

export function quotationLabel(q: { number: string | null; revision: number }) {
  if (!q.number) return "Draft";
  return q.revision > 1 ? `${q.number} (Rev ${q.revision})` : q.number;
}

export function QuotationsTable({ rows }: { rows: Rows }) {
  const today = istToday();
  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Valid until</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No quotations found.
                </TableCell>
              </TableRow>
            )}
            {rows.map((q) => (
              <TableRow key={q.id}>
                <TableCell className="font-mono text-sm">
                  <Link href={`/finance/quotations/${q.id}`} className="hover:underline">
                    {quotationLabel(q)}
                  </Link>
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
                <TableCell>
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
