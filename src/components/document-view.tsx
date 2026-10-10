// Read-only line items and totals shared by quotations and invoices.

import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR, paise } from "@/lib/money";

type Item = {
  id: string;
  position: number;
  description: string;
  sac_code: string;
  quantity: number;
  unit_price: number;
  discount_type: string;
  discount_value: number;
  tax_rate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  line_total: number;
};

type Totals = {
  supply_type: string;
  subtotal: number;
  discount_total: number;
  taxable_total: number;
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  round_off: number;
  grand_total: number;
};

const discount = (type: string, value: number) => (value > 0 ? (type === "percent" ? `${value}%` : formatINR(value)) : "—");

/** `showSac`: company setting "Show SAC codes". */
export function DocumentItemsTable({ items, showTax, showSac }: { items: Item[]; showTax: boolean; showSac: boolean }) {
  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Description</TableHead>
              {showSac && <TableHead>SAC</TableHead>}
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit price</TableHead>
              <TableHead className="text-right">Discount</TableHead>
              <TableHead className="text-right">Taxable</TableHead>
              {showTax && <TableHead className="text-right">Tax</TableHead>}
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="text-muted-foreground">{i.position}</TableCell>
                <TableCell className="whitespace-pre-line">{i.description}</TableCell>
                {showSac && <TableCell className="font-mono text-xs">{i.sac_code}</TableCell>}
                <TableCell className="text-right tabular-nums">{i.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(i.unit_price)}</TableCell>
                <TableCell className="text-right tabular-nums">{discount(i.discount_type, i.discount_value)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(i.taxable)}</TableCell>
                {showTax && (
                  <TableCell className="text-right tabular-nums">
                    {formatINR(paise(i.cgst) + paise(i.sgst) + paise(i.igst))}
                    <span className="block text-xs text-muted-foreground">{i.tax_rate}%</span>
                  </TableCell>
                )}
                <TableCell className="text-right font-medium tabular-nums">{formatINR(i.line_total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** Totals card; `children` adds rows under the total (e.g. amount paid, balance due). */
export function DocumentTotalsCard({ doc, showTax, children }: { doc: Totals; showTax: boolean; children?: ReactNode }) {
  const rows: [string, number][] = [
    ["Subtotal", doc.subtotal],
    ...(doc.discount_total > 0 ? ([["Discount", -doc.discount_total]] as [string, number][]) : []),
    ["Taxable value", doc.taxable_total],
    ...(showTax && doc.supply_type === "intra" ? ([["CGST", doc.cgst_total], ["SGST", doc.sgst_total]] as [string, number][]) : []),
    ...(showTax && doc.supply_type === "inter" ? ([["IGST", doc.igst_total]] as [string, number][]) : []),
    ...(doc.round_off !== 0 ? ([["Round off", doc.round_off]] as [string, number][]) : []),
  ];

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <span className="text-muted-foreground">{label}</span>
            <span className="tabular-nums">{formatINR(value)}</span>
          </div>
        ))}
        <Separator />
        <div className="flex items-baseline justify-between">
          <span className="font-medium">Total</span>
          <span className="font-heading text-2xl font-semibold tabular-nums">{formatINR(doc.grand_total)}</span>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
