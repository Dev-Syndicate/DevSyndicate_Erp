import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ListSkeleton } from "@/components/page-skeletons";
import { ArchivedToggle, ListPagination, parseListParams, SearchForm } from "@/components/list-controls";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/features/auth/queries";
import { ClientsTable } from "@/features/clients/components/clients-table";
import { listClients } from "@/features/clients/queries";

async function Clients({ searchParams }: { searchParams: PageProps<"/clients">["searchParams"] }) {
  const params = parseListParams(await searchParams);
  const [{ rows, total }, user] = await Promise.all([listClients(params), getCurrentUser()]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <SearchForm q={params.q} archived={params.archived} placeholder="Search clients" />
        <ArchivedToggle path="/clients" q={params.q} archived={params.archived} />
        {user?.permissions.includes("clients.create") && (
          <Button asChild className="ml-auto">
            <Link href="/clients/new">
              <Plus /> New client
            </Link>
          </Button>
        )}
      </div>
      <ClientsTable rows={rows} />
      <ListPagination path="/clients" {...params} total={total} />
    </>
  );
}

export default function ClientsPage({ searchParams }: PageProps<"/clients">) {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Clients</h1>
      <Suspense fallback={<ListSkeleton />}>
        <Clients searchParams={searchParams} />
      </Suspense>
    </>
  );
}
