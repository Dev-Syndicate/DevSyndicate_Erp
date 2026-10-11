import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FormSkeleton } from "@/components/page-skeletons";
import { CreditNoteForm } from "@/features/credit-notes/components/credit-note-form";
import { getCreditNoteFormData } from "@/features/credit-notes/queries";

async function NewCreditNote({ searchParams }: { searchParams: PageProps<"/finance/credit-notes/new">["searchParams"] }) {
  const { invoice } = await searchParams;
  if (typeof invoice !== "string") notFound();
  const data = await getCreditNoteFormData(invoice).catch(() => null);
  if (!data?.invoice || data.invoice.status !== "issued") notFound();
  return <CreditNoteForm key={`${invoice}|${data.invoice.amount_credited}`} {...data} invoice={data.invoice} />;
}

export default function NewCreditNotePage({ searchParams }: PageProps<"/finance/credit-notes/new">) {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">New credit note</h1>
      <Suspense fallback={<FormSkeleton />}>
        <NewCreditNote searchParams={searchParams} />
      </Suspense>
    </>
  );
}
