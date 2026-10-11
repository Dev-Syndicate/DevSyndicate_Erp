import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ListSkeleton } from "@/components/page-skeletons";
import { ListPagination } from "@/components/list-controls";
import { getCurrentUser } from "@/features/auth/queries";
import { AuditFilters } from "@/features/audit-logs/components/audit-filters";
import { AuditTable } from "@/features/audit-logs/components/audit-table";
import { listAuditLogs, parseAuditFilters } from "@/features/audit-logs/queries";

async function AuditLogs({ searchParams }: { searchParams: PageProps<"/settings/audit-logs">["searchParams"] }) {
  const user = await getCurrentUser();
  if (!user?.permissions.includes("audit_logs.view")) notFound();
  const f = parseAuditFilters(await searchParams);
  const { rows, total, users } = await listAuditLogs(f);
  const { page, ...filters } = f;

  return (
    <>
      <AuditFilters f={f} users={users} />
      <AuditTable rows={rows} users={users} />
      <ListPagination path="/settings/audit-logs" q="" archived={false} page={page} total={total} params={filters} />
    </>
  );
}

export default function AuditLogsPage({ searchParams }: PageProps<"/settings/audit-logs">) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">Every change to your data, recorded automatically. Entries can&apos;t be edited or deleted.</p>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <AuditLogs searchParams={searchParams} />
      </Suspense>
    </>
  );
}
