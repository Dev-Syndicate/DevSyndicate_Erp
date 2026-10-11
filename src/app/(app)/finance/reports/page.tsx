import { Suspense } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/features/auth/queries";
import { ReportFilters } from "@/features/reports/components/report-filters";
import { ReportTableCard } from "@/features/reports/components/report-table";
import { buildReport, getReportOptions } from "@/features/reports/queries";
import { parseReportParams, REPORTS } from "@/features/reports/utils";

async function Reports({ searchParams }: { searchParams: PageProps<"/finance/reports">["searchParams"] }) {
  const sp = await searchParams;
  const params = parseReportParams(sp);
  const [user, options] = await Promise.all([getCurrentUser(), getReportOptions()]);
  const report = await buildReport(params.name, params);
  const query = (extra: Record<string, string>) => {
    const q = new URLSearchParams({ report: params.name, from: params.from, to: params.to, ...extra });
    if (params.clientId && !("client" in extra)) q.set("client", params.clientId);
    if (params.categoryId && !("category" in extra)) q.set("category", params.categoryId);
    return q.toString();
  };
  // GST summary only matters once the company is GST-registered.
  const reports = REPORTS.filter((r) => r.value !== "tax" || options.gstRegistered || params.name === "tax");

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {reports.map((r) => (
          <Button key={r.value} variant={r.value === params.name ? "secondary" : "ghost"} size="sm" asChild>
            <Link href={`/finance/reports?${new URLSearchParams({ report: r.value, from: params.from, to: params.to })}`}>{r.label}</Link>
          </Button>
        ))}
        {user?.permissions.includes("reports.export") && (
          <Button variant="outline" size="sm" className="ml-auto" asChild>
            <a href={`/finance/reports/export?${query({})}`} download>
              <Download /> Download CSV
            </a>
          </Button>
        )}
      </div>
      <ReportFilters key={query({})} params={params} clients={options.clients} categories={options.categories} />
      {report.tables.map((t) => (
        <ReportTableCard key={t.title} table={t} />
      ))}
    </>
  );
}

export default function ReportsPage({ searchParams }: PageProps<"/finance/reports">) {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Reports</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Reports searchParams={searchParams} />
      </Suspense>
    </>
  );
}
