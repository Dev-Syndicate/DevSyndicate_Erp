import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ListSkeleton } from "@/components/page-skeletons";
import { ListPagination, parseListParams } from "@/components/list-controls";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/features/auth/queries";
import { OwnerTable } from "@/features/owner/components/owner-table";
import { listOwnerTransactions } from "@/features/owner/queries";

async function OwnerTransactions({ searchParams }: { searchParams: PageProps<"/finance/owner">["searchParams"] }) {
  const params = parseListParams(await searchParams);
  const [{ rows, total }, user] = await Promise.all([listOwnerTransactions(params), getCurrentUser()]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">Drawings and capital you put in. They change the company balance, not profit.</p>
        {user?.permissions.includes("owner.create") && (
          <Button asChild className="ml-auto">
            <Link href="/finance/owner/new">
              <Plus /> Record
            </Link>
          </Button>
        )}
      </div>
      <OwnerTable rows={rows} />
      <ListPagination path="/finance/owner" {...params} total={total} />
    </>
  );
}

export default function OwnerPage({ searchParams }: PageProps<"/finance/owner">) {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Owner&apos;s Account</h1>
      <Suspense fallback={<ListSkeleton />}>
        <OwnerTransactions searchParams={searchParams} />
      </Suspense>
    </>
  );
}
