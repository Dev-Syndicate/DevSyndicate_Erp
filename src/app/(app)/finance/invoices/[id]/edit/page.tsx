import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { FormSkeleton } from "@/components/page-skeletons";
import { InvoiceForm } from "@/features/invoices/components/invoice-form";
import { getInvoice, getInvoiceFormData } from "@/features/invoices/queries";

async function EditInvoice({ params }: { params: PageProps<"/finance/invoices/[id]/edit">["params"] }) {
  const { id } = await params;
  const [invoice, data] = await Promise.all([getInvoice(id).catch(() => null), getInvoiceFormData()]);
  if (!invoice) notFound();
  if (invoice.status !== "draft") redirect(`/finance/invoices/${id}`);

  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Edit draft invoice</h1>
      <InvoiceForm key={invoice.updated_at} {...data} invoice={invoice} />
    </>
  );
}

export default function EditInvoicePage({ params }: PageProps<"/finance/invoices/[id]/edit">) {
  return (
    <Suspense fallback={<FormSkeleton title />}>
      <EditInvoice params={params} />
    </Suspense>
  );
}
