import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { FormSkeleton } from "@/components/page-skeletons";
import { CreditNoteForm } from "@/features/credit-notes/components/credit-note-form";
import { getCreditNote, getCreditNoteFormData } from "@/features/credit-notes/queries";

async function EditCreditNote({ params }: { params: PageProps<"/finance/credit-notes/[id]/edit">["params"] }) {
  const { id } = await params;
  const creditNote = await getCreditNote(id).catch(() => null);
  if (!creditNote) notFound();
  if (creditNote.status !== "draft") redirect(`/finance/credit-notes/${id}`);
  const data = await getCreditNoteFormData(creditNote.invoice_id);
  if (!data.invoice) notFound();

  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Edit draft credit note</h1>
      <CreditNoteForm key={creditNote.updated_at} {...data} invoice={data.invoice} creditNote={creditNote} />
    </>
  );
}

export default function EditCreditNotePage({ params }: PageProps<"/finance/credit-notes/[id]/edit">) {
  return (
    <Suspense fallback={<FormSkeleton title />}>
      <EditCreditNote params={params} />
    </Suspense>
  );
}
