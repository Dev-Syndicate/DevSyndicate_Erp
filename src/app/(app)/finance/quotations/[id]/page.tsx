import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailSkeleton } from "@/components/page-skeletons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/features/auth/queries";
import { QuotationActions } from "@/features/quotations/components/quotation-actions";
import { QuotationStatusBadge } from "@/features/quotations/components/quotation-status-badge";
import { QuotationView } from "@/features/quotations/components/quotation-view";
import { quotationLabel } from "@/features/quotations/components/quotations-table";
import { getQuotation } from "@/features/quotations/queries";
import { displayStatus } from "@/features/quotations/schema";
import { getCompanySettings } from "@/features/settings/queries";
import { formatDate, istToday } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

async function QuotationDetail({ params }: { params: PageProps<"/finance/quotations/[id]">["params"] }) {
  const { id } = await params;
  const supabase = await createClient();
  const [q, user, newer, settings] = await Promise.all([
    getQuotation(id).catch(() => null),
    getCurrentUser(),
    supabase.from("quotations").select("id", { count: "exact", head: true }).eq("previous_revision_id", id),
    getCompanySettings(),
  ]);
  if (!q) notFound();
  const status = displayStatus(q, istToday());

  return (
    <>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{q.title}</h1>
            <QuotationStatusBadge status={status} />
          </div>
          <span className="font-mono text-sm text-muted-foreground">{quotationLabel(q)}</span>
        </div>
        <div className="ml-auto">
          <QuotationActions
            id={q.id}
            status={status}
            validUntil={q.valid_until}
            hasNewerRevision={(newer.count ?? 0) > 0}
            can={(p) => !!user?.permissions.includes(p)}
            convert={{ lines: q.quotation_items, grandTotal: q.grand_total, invoicedTotal: q.invoiced_total ?? 0, gst: q.gst_applicable && q.supply_type !== "export" }}
          />
        </div>
      </div>
      <QuotationView q={q} showSac={settings?.show_sac ?? false} />
      {q.invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-sm">
                      <Link href={`/finance/invoices/${inv.id}`} className="hover:underline">
                        {inv.number ?? "Draft"}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatDate(inv.invoice_date)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(inv.grand_total)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {inv.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default function QuotationPage({ params }: PageProps<"/finance/quotations/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <QuotationDetail params={params} />
    </Suspense>
  );
}
