import Link from "next/link";
import { DocumentItemsTable, DocumentTotalsCard } from "@/components/document-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { getInvoice } from "@/features/invoices/queries";
import { formatDate } from "@/lib/dates";

type Invoice = NonNullable<Awaited<ReturnType<typeof getInvoice>>>;

export function InvoiceView({ inv, showSac }: { inv: Invoice; showSac: boolean }) {
  const showTax = inv.gst_applicable && inv.supply_type !== "export";
  const c = inv.clients;
  // Issued invoices show the billing snapshot taken on issue; drafts show the client's current details.
  const issued = inv.status !== "draft";
  const name = issued ? inv.billing_name : c?.company_name;
  const address = issued
    ? inv.billing_address
    : [c?.billing_address, c?.city, c?.state, c?.pin_code, c?.country].filter(Boolean).join(", ");
  const gstin = issued ? inv.billing_gstin : c?.gstin;
  const quotation = inv.quotations;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Bill to</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {c && (
              <Link href={`/clients/${c.id}`} className="font-medium hover:underline">
                {name}
              </Link>
            )}
            <span className="text-muted-foreground">{address}</span>
            {gstin && <span className="font-mono text-xs">GSTIN {gstin}</span>}
            {inv.client_contacts && (
              <span className="mt-2">
                Attn: {inv.client_contacts.name}
                {inv.client_contacts.email && <span className="text-muted-foreground"> · {inv.client_contacts.email}</span>}
              </span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt className="text-muted-foreground">Invoice date</dt>
              <dd className="tabular-nums">{formatDate(inv.invoice_date)}</dd>
              <dt className="text-muted-foreground">Due date</dt>
              <dd className="tabular-nums">{formatDate(inv.due_date)}</dd>
              <dt className="text-muted-foreground">Place of supply</dt>
              <dd>{inv.supply_type === "export" ? "Outside India" : inv.place_of_supply || "—"}</dd>
              {inv.lut_number && (
                <>
                  <dt className="text-muted-foreground">LUT</dt>
                  <dd className="font-mono text-xs">{inv.lut_number}</dd>
                </>
              )}
              {quotation && (
                <>
                  <dt className="text-muted-foreground">Quotation</dt>
                  <dd>
                    <Link href={`/finance/quotations/${quotation.id}`} className="font-mono text-xs hover:underline">
                      {quotation.number ?? quotation.title}
                    </Link>
                  </dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      {inv.over_quotation_reason && (
        <p className="text-sm text-muted-foreground">
          Issued beyond the quotation total. Reason: <span className="text-foreground">{inv.over_quotation_reason}</span>
        </p>
      )}

      <DocumentItemsTable items={inv.invoice_items} showTax={showTax} showSac={showSac} />

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <Card>
          <CardHeader>
            <CardTitle>Terms & notes</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-2">
            <p className="whitespace-pre-line">{inv.terms || <span className="text-muted-foreground">No terms</span>}</p>
            <p className="whitespace-pre-line">{inv.notes || <span className="text-muted-foreground">No notes</span>}</p>
          </CardContent>
        </Card>
        <DocumentTotalsCard doc={inv} showTax={showTax} />
      </div>
    </div>
  );
}
