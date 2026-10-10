import Link from "next/link";
import { DocumentItemsTable, DocumentTotalsCard } from "@/components/document-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { getQuotation } from "@/features/quotations/queries";
import { formatDate } from "@/lib/dates";

type Quotation = NonNullable<Awaited<ReturnType<typeof getQuotation>>>;

export function QuotationView({ q, showSac }: { q: Quotation; showSac: boolean }) {
  const showTax = q.gst_applicable && q.supply_type !== "export";
  const c = q.clients;

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

      <DocumentItemsTable items={q.quotation_items} showTax={showTax} showSac={showSac} />

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
        <DocumentTotalsCard doc={q} showTax={showTax} />
      </div>
    </div>
  );
}
