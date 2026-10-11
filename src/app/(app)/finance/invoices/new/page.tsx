import { Suspense } from "react";
import { FormSkeleton } from "@/components/page-skeletons";
import { InvoiceForm } from "@/features/invoices/components/invoice-form";
import { getInvoiceFormData } from "@/features/invoices/queries";

async function NewInvoice() {
  return <InvoiceForm {...await getInvoiceFormData()} />;
}

export default function NewInvoicePage() {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">New invoice</h1>
      <Suspense fallback={<FormSkeleton />}>
        <NewInvoice />
      </Suspense>
    </>
  );
}
