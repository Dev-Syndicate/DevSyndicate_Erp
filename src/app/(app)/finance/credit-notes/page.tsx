import { Suspense } from "react";
import { ListSkeleton } from "@/components/page-skeletons";
import { ListPagination, parseListParams, SearchForm } from "@/components/list-controls";
import { CreditNotesTable } from "@/features/credit-notes/components/credit-notes-table";
import { listCreditNotes } from "@/features/credit-notes/queries";

async function CreditNotes({ searchParams }: { searchParams: PageProps<"/finance/credit-notes">["searchParams"] }) {
  const params = parseListParams(await searchParams);
  const { rows, total } = await listCreditNotes(params);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <SearchForm q={params.q} archived={false} placeholder="Search by number" />
        <p className="ml-auto text-sm text-muted-foreground">To create one, open an issued invoice and choose Credit note.</p>
      </div>
      <CreditNotesTable rows={rows} />
      <ListPagination path="/finance/credit-notes" {...params} total={total} />
    </>
  );
}

export default function CreditNotesPage({ searchParams }: PageProps<"/finance/credit-notes">) {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Credit notes</h1>
      <Suspense fallback={<ListSkeleton />}>
        <CreditNotes searchParams={searchParams} />
      </Suspense>
    </>
  );
}
