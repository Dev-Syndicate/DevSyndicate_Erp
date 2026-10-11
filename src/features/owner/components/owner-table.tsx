import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, UserRound } from "lucide-react";
import { EmptyRow } from "@/components/list-controls";
import { StatusTile } from "@/components/status-tile";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ownerKindLabel } from "@/features/owner/schema";
import type { listOwnerTransactions } from "@/features/owner/queries";
import { formatDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { methodLabel } from "@/lib/payment-methods";

type Rows = Awaited<ReturnType<typeof listOwnerTransactions>>["rows"];

export function OwnerTable({ rows }: { rows: Rows }) {
  return (
    <Card className="flex-1">
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-[40%]">Notes</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <EmptyRow colSpan={5} icon={UserRound} title="No drawings yet" description="Money you take out of or put into the business appears here." />
            )}
            {rows.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <StatusTile icon={t.kind === "drawing" ? ArrowUpRight : ArrowDownLeft} />
                    <Link href={`/finance/owner/${t.id}`} className="hover:underline">
                      {ownerKindLabel(t.kind)}
                    </Link>
                  </div>
                </TableCell>
                <TableCell className="tabular-nums">{formatDate(t.txn_date)}</TableCell>
                <TableCell className="max-w-72 truncate text-muted-foreground">{t.notes || "—"}</TableCell>
                <TableCell>{methodLabel(t.method)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {t.kind === "drawing" ? "−" : "+"}
                  {formatINR(t.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
