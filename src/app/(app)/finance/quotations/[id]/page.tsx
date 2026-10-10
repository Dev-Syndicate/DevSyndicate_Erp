import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/features/auth/queries";
import { QuotationActions } from "@/features/quotations/components/quotation-actions";
import { QuotationStatusBadge } from "@/features/quotations/components/quotation-status-badge";
import { QuotationView } from "@/features/quotations/components/quotation-view";
import { quotationLabel } from "@/features/quotations/components/quotations-table";
import { getQuotation } from "@/features/quotations/queries";
import { displayStatus } from "@/features/quotations/schema";
import { istToday } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

async function QuotationDetail({ params }: { params: PageProps<"/finance/quotations/[id]">["params"] }) {
  const { id } = await params;
  const supabase = await createClient();
  const [q, user, newer] = await Promise.all([
    getQuotation(id).catch(() => null),
    getCurrentUser(),
    supabase.from("quotations").select("id", { count: "exact", head: true }).eq("previous_revision_id", id),
  ]);
  if (!q) notFound();
  const status = displayStatus(q.status, q.valid_until, istToday());

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
          />
        </div>
      </div>
      <QuotationView q={q} />
    </>
  );
}

export default function QuotationPage({ params }: PageProps<"/finance/quotations/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <QuotationDetail params={params} />
    </Suspense>
  );
}
