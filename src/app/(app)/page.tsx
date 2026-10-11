import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/features/auth/queries";
import { AgeingCard } from "@/features/dashboard/components/ageing-card";
import { DashboardLists, RecentQuotations } from "@/features/dashboard/components/dashboard-lists";
import { KpiCards } from "@/features/dashboard/components/kpi-cards";
import { PeriodSelect } from "@/features/dashboard/components/period-select";
import { RevenueChart } from "@/features/dashboard/components/revenue-chart";
import { getDashboard, getDashboardLists, getRecentQuotations } from "@/features/dashboard/queries";
import { PERIODS, periodRange } from "@/lib/periods";
import { istToday } from "@/lib/dates";

async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const user = await getCurrentUser();
  // Financial KPIs need reports.view (PRD §10); others see their recent quotations.
  if (!user?.permissions.includes("reports.view")) {
    return user?.permissions.includes("quotations.view") ? <RecentQuotations rows={await getRecentQuotations()} /> : null;
  }

  const { period } = await searchParams;
  const value = PERIODS.some((p) => p.value === period) ? (period as string) : "fy";
  const { from, to } = periodRange(value, istToday());
  const [figures, lists] = await Promise.all([getDashboard(from, to), getDashboardLists()]);
  const fyStart = Number(figures.monthly[0].month.slice(0, 4));

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {formatRange(from)} – {formatRange(to)}
        </span>
        <div className="ml-auto">
          <PeriodSelect value={value} />
        </div>
      </div>
      <KpiCards f={figures} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <RevenueChart monthly={figures.monthly} fy={`${fyStart}-${String(fyStart + 1).slice(2)}`} />
        <AgeingCard ageing={figures.ageing} total={figures.outstanding} />
      </div>
      <DashboardLists lists={lists} />
    </>
  );
}

const formatRange = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default function DashboardPage({ searchParams }: PageProps<"/">) {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Dashboard</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </>
  );
}
