import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ListPagination, parseListParams, SearchForm } from "@/components/list-controls";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/features/auth/queries";
import { QuotationsTable } from "@/features/quotations/components/quotations-table";
import { listQuotations } from "@/features/quotations/queries";

async function Quotations({ searchParams }: { searchParams: PageProps<"/finance/quotations">["searchParams"] }) {
  const params = parseListParams(await searchParams);
  const [{ rows, total }, user] = await Promise.all([listQuotations(params), getCurrentUser()]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <SearchForm q={params.q} archived={false} placeholder="Search by title or number" />
        {user?.permissions.includes("quotations.create") && (
          <Button asChild className="ml-auto">
            <Link href="/finance/quotations/new">
              <Plus /> New quotation
            </Link>
          </Button>
        )}
      </div>
      <QuotationsTable rows={rows} />
      <ListPagination path="/finance/quotations" {...params} total={total} />
    </>
  );
}

export default function QuotationsPage({ searchParams }: PageProps<"/finance/quotations">) {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Quotations</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Quotations searchParams={searchParams} />
      </Suspense>
    </>
  );
}
