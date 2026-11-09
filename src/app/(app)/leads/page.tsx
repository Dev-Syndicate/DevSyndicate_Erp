import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ListSkeleton } from "@/components/page-skeletons";
import { ListPagination, PAGE_SIZE, parseListParams } from "@/components/list-controls";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/features/auth/queries";
import { LeadFilters } from "@/features/leads/components/lead-filters";
import { LeadsTable } from "@/features/leads/components/leads-table";
import { getLeadUsers, LEAD_VIEWS, listLeads, type LeadView } from "@/features/leads/queries";
import { LEAD_SOURCES, OPEN_STATUSES, sourceLabel, statusLabel, urlDate } from "@/features/leads/schema";
import { formatDate } from "@/lib/dates";

async function Leads({ searchParams }: { searchParams: PageProps<"/leads">["searchParams"] }) {
  const raw = await searchParams;
  const params = parseListParams(raw);
  const view = (LEAD_VIEWS.find((v) => v.value === raw.view)?.value ?? "open") as LeadView;
  const users = await getLeadUsers().catch(() => []);
  // Anything not on these lists (including the form's "all") means no filter.
  const source = LEAD_SOURCES.find((s) => s.value === raw.source)?.value ?? "";
  const pickedStatus = OPEN_STATUSES.find((s) => s === raw.status) ?? "";
  const addedBy = users.find((u) => u.id === raw.added_by);
  const from = urlDate(raw.from);
  const to = urlDate(raw.to);
  // Won and Lost have no status to pick; the choice comes back on the other views.
  const status = view === "won" || view === "lost" ? "" : pickedStatus;
  const [{ rows, total }, user] = await Promise.all([listLeads({ ...params, view, source, status, addedBy: addedBy?.id, from, to }), getCurrentUser()]);
  const kept = { ...(source && { source }), ...(pickedStatus && { status: pickedStatus }), ...(addedBy && { added_by: addedBy.id }) };
  const filters = { ...kept, ...(from && { from }), ...(to && { to }) };
  const datesHref = (dates: Record<string, string>) => `/leads?${new URLSearchParams({ ...(view !== "open" && { view }), ...(params.q && { q: params.q }), ...kept, ...dates })}`;
  const viewHref = (v: string) => `/leads?${new URLSearchParams({ ...(v !== "open" && { view: v }), ...(params.q && { q: params.q }), ...filters })}`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
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
      <LeadFilters f={{ q: params.q, view, source, status, addedBy: addedBy?.id ?? "", from, to, custom: raw.custom === "1" }} users={users} datesHref={datesHref} />
      <p className="text-sm text-muted-foreground">
        {total} {total === 1 ? "lead" : "leads"}
        {view !== "all" && ` · ${LEAD_VIEWS.find((v) => v.value === view)?.label}`}
        {source && ` · ${sourceLabel(source)}`}
        {status && ` · ${statusLabel(status)}`}
        {addedBy && ` · Added by ${addedBy.full_name || addedBy.email}`}
        {(from || to) && ` · Added ${[from && `from ${formatDate(from)}`, to && `to ${formatDate(to)}`].filter(Boolean).join(" ")}`}
        {params.q && ` matching “${params.q}”`}
      </p>
      <LeadsTable rows={rows} offset={(params.page - 1) * PAGE_SIZE} />
      <ListPagination path="/leads" {...params} total={total} params={{ view: view === "open" ? "" : view, ...filters }} />
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
