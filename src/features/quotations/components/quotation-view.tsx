import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { getQuotation } from "@/features/quotations/queries";
import { formatDate } from "@/lib/dates";
import { formatINR, paise } from "@/lib/money";

type Quotation = NonNullable<Awaited<ReturnType<typeof getQuotation>>>;

export function QuotationView({ q }: { q: Quotation }) {
  const showTax = q.gst_applicable && q.supply_type !== "export";
  const c = q.clients;
  const discount = (type: string, value: number) => (value > 0 ? (type === "percent" ? `${value}%` : formatINR(value)) : "—");

  const totals: [string, number][] = [
    ["Subtotal", q.subtotal],
    ...(q.discount_total > 0 ? ([["Discount", -q.discount_total]] as [string, number][]) : []),
    ["Taxable value", q.taxable_total],
    ...(showTax && q.supply_type === "intra" ? ([["CGST", q.cgst_total], ["SGST", q.sgst_total]] as [string, number][]) : []),
    ...(showTax && q.supply_type === "inter" ? ([["IGST", q.igst_total]] as [string, number][]) : []),
    ...(q.round_off !== 0 ? ([["Round off", q.round_off]] as [string, number][]) : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Client</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {c && (
              <Link href={`/clients/${c.id}`} className="font-medium hover:underline">
                {c.company_name}
              </Link>
            )}
            <span className="text-muted-foreground">
              {[c?.billing_address, c?.city, c?.state, c?.pin_code, c?.country].filter(Boolean).join(", ")}
            </span>
            {c?.gstin && <span className="font-mono text-xs">GSTIN {c.gstin}</span>}
            {q.client_contacts && (
              <span className="mt-2">
                Attn: {q.client_contacts.name}
                {q.client_contacts.email && <span className="text-muted-foreground"> · {q.client_contacts.email}</span>}
              </span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt className="text-muted-foreground">Date</dt>
              <dd className="tabular-nums">{formatDate(q.quotation_date)}</dd>
              <dt className="text-muted-foreground">Valid until</dt>
              <dd className="tabular-nums">{formatDate(q.valid_until)}</dd>
              <dt className="text-muted-foreground">Place of supply</dt>
              <dd>{q.supply_type === "export" ? "Outside India" : q.place_of_supply || "—"}</dd>
            </dl>
          </CardContent>
        </Card>
      </div>

      {q.description && <p className="text-sm whitespace-pre-line text-muted-foreground">{q.description}</p>}

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>SAC</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                {showTax && <TableHead className="text-right">Tax</TableHead>}
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.quotation_items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="text-muted-foreground">{i.position}</TableCell>
                  <TableCell className="whitespace-pre-line">{i.description}</TableCell>
                  <TableCell className="font-mono text-xs">{i.sac_code}</TableCell>
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

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <Card>
          <CardHeader>
            <CardTitle>Terms & notes</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-2">
            <p className="whitespace-pre-line">{q.terms || <span className="text-muted-foreground">No terms</span>}</p>
            <p className="whitespace-pre-line">{q.notes || <span className="text-muted-foreground">No notes</span>}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-3 text-sm">
            {totals.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{label}</span>
                <span className="tabular-nums">{formatINR(value)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex items-baseline justify-between">
              <span className="font-medium">Total</span>
              <span className="font-heading text-2xl font-semibold tabular-nums">{formatINR(q.grand_total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
