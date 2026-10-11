import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ListPagination, parseListParams, SearchForm } from "@/components/list-controls";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/features/auth/queries";
import { ExpensesTable } from "@/features/expenses/components/expenses-table";
import { listExpenses } from "@/features/expenses/queries";

async function Expenses({ searchParams }: { searchParams: PageProps<"/finance/expenses">["searchParams"] }) {
  const params = parseListParams(await searchParams);
  const [{ rows, total }, user] = await Promise.all([listExpenses(params), getCurrentUser()]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <SearchForm q={params.q} archived={false} placeholder="Search by number or description" />
        {user?.permissions.includes("expenses.create") && (
          <Button asChild className="ml-auto">
            <Link href="/finance/expenses/new">
              <Plus /> Record expense
            </Link>
          </Button>
        )}
      </div>
      <ExpensesTable rows={rows} />
      <ListPagination path="/finance/expenses" {...params} total={total} />
    </>
  );
}

export default function ExpensesPage({ searchParams }: PageProps<"/finance/expenses">) {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Expenses</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Expenses searchParams={searchParams} />
      </Suspense>
    </>
  );
}
