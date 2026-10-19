import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ListSkeleton } from "@/components/page-skeletons";
import { ListPagination, parseListParams, SearchForm } from "@/components/list-controls";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/features/auth/queries";
import { LeadsTable } from "@/features/leads/components/leads-table";
import { LEAD_VIEWS, listLeads, type LeadView } from "@/features/leads/queries";

async function Leads({ searchParams }: { searchParams: PageProps<"/leads">["searchParams"] }) {
  const raw = await searchParams;
  const params = parseListParams(raw);
  const view = (LEAD_VIEWS.find((v) => v.value === raw.view)?.value ?? "open") as LeadView;
  const [{ rows, total }, user] = await Promise.all([listLeads({ ...params, view }), getCurrentUser()]);
  const viewHref = (v: string) => `/leads?${new URLSearchParams({ ...(v !== "open" && { view: v }), ...(params.q && { q: params.q }) })}`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <SearchForm q={params.q} archived={false} placeholder="Search name, company, email, phone" />
        <div className="flex flex-wrap gap-1">
          {LEAD_VIEWS.map((v) => (
            <Button key={v.value} variant={v.value === view ? "secondary" : "ghost"} size="sm" asChild>
              <Link href={viewHref(v.value)}>{v.label}</Link>
            </Button>
          ))}
        </div>
        {user?.permissions.includes("leads.create") && (
          <Button asChild className="ml-auto">
            <Link href="/leads/new">
              <Plus /> New lead
            </Link>
          </Button>
        )}
      </div>
      <LeadsTable rows={rows} />
      <ListPagination path="/leads" {...params} total={total} params={{ view: view === "open" ? "" : view }} />
    </>
  );
}

export default function LeadsPage({ searchParams }: PageProps<"/leads">) {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Leads</h1>
      <Suspense fallback={<ListSkeleton />}>
        <Leads searchParams={searchParams} />
      </Suspense>
    </>
  );
}
