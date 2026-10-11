import Link from "next/link";
import { Wallet } from "lucide-react";
import { EmptyRow } from "@/components/list-controls";
import { StatusTile } from "@/components/status-tile";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { listExpenses } from "@/features/expenses/queries";
import { formatDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";

type Rows = Awaited<ReturnType<typeof listExpenses>>["rows"];

export function ExpensesTable({ rows }: { rows: Rows }) {
  return (
    <Card className="flex-1">
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-[30%]">Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <EmptyRow colSpan={6} icon={Wallet} title="No expenses yet" description="Money you pay appears here. If you searched, try a different number or description." />
            )}
            {rows.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-sm">
                  <div className="flex items-center gap-3">
                    <StatusTile icon={Wallet} />
                    <Link href={`/finance/expenses/${e.id}`} className="hover:underline">
                      {e.number}
                    </Link>
                  </div>
                </TableCell>
                <TableCell className="tabular-nums">{formatDate(e.expense_date)}</TableCell>
                <TableCell className="max-w-72 truncate font-medium">{e.description}</TableCell>
                <TableCell>{e.expense_categories?.name}</TableCell>
                <TableCell>{e.vendors?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(e.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
