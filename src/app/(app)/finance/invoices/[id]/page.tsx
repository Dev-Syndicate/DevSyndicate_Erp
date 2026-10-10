import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/features/auth/queries";
import { InvoiceActions } from "@/features/invoices/components/invoice-actions";
import { InvoiceStatusBadge } from "@/features/invoices/components/invoice-status-badge";
import { InvoiceView } from "@/features/invoices/components/invoice-view";
import { getInvoice } from "@/features/invoices/queries";
import { displayStatus, invoiceLabel } from "@/features/invoices/schema";
import { getCompanySettings } from "@/features/settings/queries";
import { istToday } from "@/lib/dates";

async function InvoiceDetail({ params }: { params: PageProps<"/finance/invoices/[id]">["params"] }) {
  const { id } = await params;
  const [inv, user, settings] = await Promise.all([getInvoice(id).catch(() => null), getCurrentUser(), getCompanySettings()]);
  if (!inv) notFound();
  const status = displayStatus(inv, istToday());

  return (
    <>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {inv.gst_applicable ? "Tax Invoice" : "Invoice"}
            </h1>
            <InvoiceStatusBadge status={status} />
          </div>
          <span className="font-mono text-sm text-muted-foreground">{invoiceLabel(inv)}</span>
        </div>
        <div className="ml-auto">
          <InvoiceActions id={inv.id} status={status} can={(p) => !!user?.permissions.includes(p)} />
        </div>
      </div>
      <InvoiceView inv={inv} showSac={settings?.show_sac ?? false} />
    </>
  );
}

export default function InvoicePage({ params }: PageProps<"/finance/invoices/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <InvoiceDetail params={params} />
    </Suspense>
  );
}
