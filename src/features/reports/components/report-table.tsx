import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Cell, Column, ReportTable } from "@/features/reports/utils";
import { formatDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";

function show(c: Column, v: Cell) {
  if (v === null || v === undefined || v === "") return <span className="text-muted-foreground">—</span>;
  if (c.kind === "money") return formatINR(v as bigint);
  if (c.kind === "date") return formatDate(String(v));
  return String(v);
}

const right = (c: Column) => c.kind === "money" || c.kind === "number";

export function ReportTableCard({ table }: { table: ReportTable }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{table.title}</CardTitle>
        {table.description && <CardDescription>{table.description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {table.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{table.empty ?? "Nothing in this period."}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {table.columns.map((c) => (
                  <TableHead key={c.key} className={right(c) ? "text-right" : undefined}>
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.rows.map((r, i) => (
                <TableRow key={i}>
                  {table.columns.map((c, j) => (
                    <TableCell key={c.key} className={right(c) ? "text-right tabular-nums whitespace-nowrap" : c.kind === "date" ? "tabular-nums whitespace-nowrap" : undefined}>
                      {/* The first column links to the record when there is one. */}
                      {j === 0 && r.href ? (
                        <Link href={r.href} className="hover:underline">
                          {show(c, r[c.key])}
                        </Link>
                      ) : (
                        show(c, r[c.key])
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
            {table.total && (
              <TableFooter>
                <TableRow>
                  {table.columns.map((c) => (
                    <TableCell key={c.key} className={right(c) ? "text-right font-medium tabular-nums" : "font-medium"}>
                      {table.total![c.key] === undefined ? null : show(c, table.total![c.key])}
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            )}
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
