import { Suspense } from "react";
import { FormSkeleton } from "@/components/page-skeletons";
import { getCurrentUser } from "@/features/auth/queries";
import { PaymentForm } from "@/features/payments/components/payment-form";
import { getOpenInvoices, getPaymentClients } from "@/features/payments/queries";

async function NewPayment({ searchParams }: { searchParams: PageProps<"/finance/payments/new">["searchParams"] }) {
  const { invoice } = await searchParams;
  const [clients, invoices, user] = await Promise.all([getPaymentClients(), getOpenInvoices(), getCurrentUser()]);
  return (
    <PaymentForm
      // Next keeps a page's client state when you navigate away and back (Activity); a new key whenever the
      // balances change makes the form start fresh instead of showing amounts from an earlier visit.
      key={`${invoice ?? ""}|${invoices.map((i) => `${i.id}:${i.balance_due}`).join(",")}`}
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
      <Suspense fallback={<FormSkeleton />}>
        <NewPayment searchParams={searchParams} />
      </Suspense>
    </>
  );
}
