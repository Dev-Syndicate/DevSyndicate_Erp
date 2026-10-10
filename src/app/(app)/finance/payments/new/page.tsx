import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/features/auth/queries";
import { PaymentForm } from "@/features/payments/components/payment-form";
import { getOpenInvoices, getPaymentClients } from "@/features/payments/queries";

async function NewPayment({ searchParams }: { searchParams: PageProps<"/finance/payments/new">["searchParams"] }) {
  const { invoice } = await searchParams;
  const [clients, invoices, user] = await Promise.all([getPaymentClients(), getOpenInvoices(), getCurrentUser()]);
  return (
    <PaymentForm
      clients={clients}
      invoices={invoices}
      canRefund={!!user?.permissions.includes("payments.refund")}
      presetInvoiceId={typeof invoice === "string" ? invoice : undefined}
    />
  );
}

export default function NewPaymentPage({ searchParams }: PageProps<"/finance/payments/new">) {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Record payment</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <NewPayment searchParams={searchParams} />
      </Suspense>
    </>
  );
}
