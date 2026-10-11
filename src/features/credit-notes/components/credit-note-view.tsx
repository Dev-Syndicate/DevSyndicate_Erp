import Link from "next/link";
import { DocumentItemsTable, DocumentTotalsCard } from "@/components/document-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { getCreditNote } from "@/features/credit-notes/queries";
import { formatDate } from "@/lib/dates";

type CreditNote = NonNullable<Awaited<ReturnType<typeof getCreditNote>>>;

export function CreditNoteView({ cn, showSac }: { cn: CreditNote; showSac: boolean }) {
  const showTax = cn.gst_applicable && cn.supply_type !== "export";
  const inv = cn.invoices;
  // Recipient as on the invoice (Rule 53); the snapshot is copied when the credit note is issued.
  const name = cn.status === "draft" ? inv?.billing_name : cn.billing_name;
  const address = cn.status === "draft" ? inv?.billing_address : cn.billing_address;
  const gstin = cn.status === "draft" ? inv?.billing_gstin : cn.billing_gstin;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Credit to</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {cn.clients && (
              <Link href={`/clients/${cn.clients.id}`} className="font-medium hover:underline">
                {name || cn.clients.company_name}
              </Link>
            )}
            <span className="text-muted-foreground">{address}</span>
            {gstin && <span className="font-mono text-xs">GSTIN {gstin}</span>}
            <span className="mt-2">Reason: {cn.reason}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt className="text-muted-foreground">Date</dt>
              <dd className="tabular-nums">{formatDate(cn.credit_note_date)}</dd>
              <dt className="text-muted-foreground">Invoice</dt>
              <dd>
                {inv && (
                  <Link href={`/finance/invoices/${inv.id}`} className="font-mono text-xs hover:underline">
                    {inv.number}
                  </Link>
                )}
              </dd>
              <dt className="text-muted-foreground">Invoice date</dt>
              <dd className="tabular-nums">{formatDate(inv?.invoice_date)}</dd>
              <dt className="text-muted-foreground">Place of supply</dt>
              <dd>{cn.supply_type === "export" ? "Outside India" : cn.place_of_supply || "—"}</dd>
            </dl>
          </CardContent>
        </Card>
      </div>

      <DocumentItemsTable items={cn.credit_note_items} showTax={showTax} showSac={showSac} />

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-line">{cn.notes || <span className="text-muted-foreground">No notes</span>}</CardContent>
        </Card>
        <DocumentTotalsCard doc={cn} showTax={showTax} />
      </div>
    </div>
  );
}
