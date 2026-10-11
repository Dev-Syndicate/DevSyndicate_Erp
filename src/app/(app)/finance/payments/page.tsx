import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ListSkeleton } from "@/components/page-skeletons";
import { ListPagination, parseListParams, SearchForm } from "@/components/list-controls";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/features/auth/queries";
import { PaymentsTable } from "@/features/payments/components/payments-table";
import { listPayments } from "@/features/payments/queries";

async function Payments({ searchParams }: { searchParams: PageProps<"/finance/payments">["searchParams"] }) {
  const params = parseListParams(await searchParams);
  const [{ rows, total }, user] = await Promise.all([listPayments(params), getCurrentUser()]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <SearchForm q={params.q} archived={false} placeholder="Search by receipt number" />
        {user?.permissions.includes("payments.create") && (
          <Button asChild className="ml-auto">
            <Link href="/finance/payments/new">
              <Plus /> Record payment
            </Link>
          </Button>
        )}
      </div>
      <PaymentsTable rows={rows} />
      <ListPagination path="/finance/payments" {...params} total={total} />
    </>
  );
}

export default function PaymentsPage({ searchParams }: PageProps<"/finance/payments">) {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Payments</h1>
      <Suspense fallback={<ListSkeleton />}>
        <Payments searchParams={searchParams} />
      </Suspense>
    </>
  );
}
