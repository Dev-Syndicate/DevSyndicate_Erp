import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ListSkeleton } from "@/components/page-skeletons";
import { ArchivedToggle, ListPagination, parseListParams, SearchForm } from "@/components/list-controls";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/features/auth/queries";
import { VendorsTable } from "@/features/vendors/components/vendors-table";
import { listVendors } from "@/features/vendors/queries";

async function Vendors({ searchParams }: { searchParams: PageProps<"/vendors">["searchParams"] }) {
  const params = parseListParams(await searchParams);
  const [{ rows, total }, user] = await Promise.all([listVendors(params), getCurrentUser()]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <SearchForm q={params.q} archived={params.archived} placeholder="Search vendors" />
        <ArchivedToggle path="/vendors" q={params.q} archived={params.archived} />
        {user?.permissions.includes("vendors.create") && (
          <Button asChild className="ml-auto">
            <Link href="/vendors/new">
              <Plus /> New vendor
            </Link>
          </Button>
        )}
      </div>
      <VendorsTable rows={rows} />
      <ListPagination path="/vendors" {...params} total={total} />
    </>
  );
}

export default function VendorsPage({ searchParams }: PageProps<"/vendors">) {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Vendors</h1>
      <Suspense fallback={<ListSkeleton />}>
        <Vendors searchParams={searchParams} />
      </Suspense>
    </>
  );
}
