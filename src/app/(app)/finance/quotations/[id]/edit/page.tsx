import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { QuotationForm } from "@/features/quotations/components/quotation-form";
import { quotationLabel } from "@/features/quotations/components/quotations-table";
import { getQuotation, getQuotationFormData } from "@/features/quotations/queries";

async function EditQuotation({ params }: { params: PageProps<"/finance/quotations/[id]/edit">["params"] }) {
  const { id } = await params;
  const [quotation, data] = await Promise.all([getQuotation(id).catch(() => null), getQuotationFormData()]);
  if (!quotation) notFound();
  if (quotation.status !== "draft") redirect(`/finance/quotations/${id}`);

  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Edit {quotationLabel(quotation)}</h1>
      <QuotationForm {...data} quotation={quotation} />
    </>
  );
}

export default function EditQuotationPage({ params }: PageProps<"/finance/quotations/[id]/edit">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <EditQuotation params={params} />
    </Suspense>
  );
}
