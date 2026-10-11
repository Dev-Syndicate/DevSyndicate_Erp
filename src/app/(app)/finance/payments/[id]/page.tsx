import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ProofsCard } from "@/components/proofs-card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/features/auth/queries";
import { PaymentActions } from "@/features/payments/components/payment-actions";
import { PaymentStatusBadge } from "@/features/payments/components/payment-status-badge";
import { PaymentView } from "@/features/payments/components/payment-view";
import { getOpenInvoices, getPayment } from "@/features/payments/queries";
import type { PaymentStatus } from "@/features/payments/schema";
import { getDocuments } from "@/lib/documents/queries";
import { formatINR, paise } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

async function PaymentDetail({ params }: { params: PageProps<"/finance/payments/[id]">["params"] }) {
  const { id } = await params;
  const supabase = await createClient();
  const [p, user, proofs, org] = await Promise.all([
    getPayment(id).catch(() => null),
    getCurrentUser(),
    getDocuments("payment", id).catch(() => []),
    supabase.rpc("current_org_id"),
  ]);
  if (!p) notFound();
  const can = (perm: string) => !!user?.permissions.includes(perm);
  const openInvoices = p.status === "confirmed" && p.kind === "receipt" ? await getOpenInvoices(p.client_id) : [];
  const total = p.kind === "refund" ? paise(p.amount) : paise(p.amount) + paise(p.tds_amount);

  return (
    <>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {p.kind === "refund" ? "Refund" : "Payment"} {formatINR(total)}
            </h1>
            <PaymentStatusBadge status={p.status as PaymentStatus} />
          </div>
          <span className={p.number ? "font-mono text-sm text-muted-foreground" : "text-sm text-muted-foreground"}>
            {p.number ?? (p.status === "pending" ? "Receipt number is given when confirmed" : "Cancelled before confirming")}
          </span>
        </div>
        <div className="ml-auto">
          <PaymentActions p={p} organizationId={org.data ?? ""} openInvoices={openInvoices} can={can} />
        </div>
      </div>
      <PaymentView p={p} canUnapply={p.status === "confirmed" && can("payments.update")} />
      {/* Pending payments attach proof in the Confirm dialog. */}
      {org.data && (p.status === "confirmed" || proofs.length > 0) && (
        <ProofsCard
          entityType="payment"
          entityId={p.id}
          title="Payment proof"
          description="UPI screenshot, bank receipt or confirmation."
          organizationId={org.data}
          proofs={proofs}
          canAdd={p.status !== "cancelled" && (can("payments.create") || can("payments.update"))}
          canRemove={can("payments.update")}
        />
      )}
    </>
  );
}

export default function PaymentPage({ params }: PageProps<"/finance/payments/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <PaymentDetail params={params} />
    </Suspense>
  );
}
