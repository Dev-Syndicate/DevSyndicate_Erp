import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { QuotationForm } from "@/features/quotations/components/quotation-form";
import { getQuotationFormData } from "@/features/quotations/queries";

async function NewQuotation() {
  return <QuotationForm {...await getQuotationFormData()} />;
}

export default function NewQuotationPage() {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">New quotation</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <NewQuotation />
      </Suspense>
    </>
  );
}
