import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { FormSkeleton } from "@/components/page-skeletons";
import { getCurrentUser } from "@/features/auth/queries";
import { PaymentForm } from "@/features/payments/components/payment-form";
import { getOpenInvoices, getPayment, getPaymentClients } from "@/features/payments/queries";

async function EditPayment({ params }: { params: PageProps<"/finance/payments/[id]/edit">["params"] }) {
  const { id } = await params;
  const [payment, clients, invoices, user] = await Promise.all([
    getPayment(id).catch(() => null),
    getPaymentClients(),
    getOpenInvoices(),
    getCurrentUser(),
  ]);
  if (!payment) notFound();
  if (payment.status !== "pending") redirect(`/finance/payments/${id}`);

  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Edit pending payment</h1>
      <PaymentForm key={payment.updated_at} clients={clients} invoices={invoices} canRefund={!!user?.permissions.includes("payments.refund")} payment={payment} />
    </>
  );
}

export default function EditPaymentPage({ params }: PageProps<"/finance/payments/[id]/edit">) {
  return (
    <Suspense fallback={<FormSkeleton title />}>
      <EditPayment params={params} />
    </Suspense>
  );
}
