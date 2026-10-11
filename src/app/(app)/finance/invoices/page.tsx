import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ListSkeleton } from "@/components/page-skeletons";
import { ListPagination, parseListParams, SearchForm } from "@/components/list-controls";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/features/auth/queries";
import { InvoicesTable } from "@/features/invoices/components/invoices-table";
import { listInvoices } from "@/features/invoices/queries";

async function Invoices({ searchParams }: { searchParams: PageProps<"/finance/invoices">["searchParams"] }) {
  const params = parseListParams(await searchParams);
  const [{ rows, total }, user] = await Promise.all([listInvoices(params), getCurrentUser()]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <SearchForm q={params.q} archived={false} placeholder="Search by number" />
        {user?.permissions.includes("invoices.create") && (
          <Button asChild className="ml-auto">
            <Link href="/finance/invoices/new">
              <Plus /> New invoice
            </Link>
          </Button>
        )}
      </div>
      <InvoicesTable rows={rows} />
      <ListPagination path="/finance/invoices" {...params} total={total} />
    </>
  );
}

export default function InvoicesPage({ searchParams }: PageProps<"/finance/invoices">) {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Invoices</h1>
      <Suspense fallback={<ListSkeleton />}>
        <Invoices searchParams={searchParams} />
      </Suspense>
    </>
  );
}
