import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Loading placeholders shaped like the pages they stand in for, so content doesn't jump when it arrives.

function TableRows({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="flex flex-col">
      <div className="flex gap-6 border-b pb-3">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-6 border-b py-4 last:border-0">
          {Array.from({ length: cols }, (_, i) => (
            <Skeleton key={i} className={i === 0 ? "h-4 flex-[1.5]" : "h-4 flex-1"} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Search + action button, then a table. */
export function ListSkeleton() {
  return (
    <>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-full max-w-sm" />
        <Skeleton className="ml-auto h-9 w-36" />
      </div>
      <Card className="flex-1">
        <CardContent>
          <TableRows />
        </CardContent>
      </Card>
    </>
  );
}

function StatCard({ small }: { small?: boolean }) {
  return (
    <Card size={small ? "sm" : "default"}>
      <CardHeader className="gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className={small ? "h-6 w-28" : "h-8 w-36"} />
        <Skeleton className="h-3 w-40" />
      </CardHeader>
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-9 w-52" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <StatCard key={i} />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <StatCard key={i} small />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardContent>
            <Skeleton className="h-80 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-5">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/** Title + actions, info cards, then a table (invoice, quotation, payment… pages). */
export function DetailSkeleton() {
  return (
    <>
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent>
          <TableRows rows={3} cols={4} />
        </CardContent>
      </Card>
    </>
  );
}

/** Cards of labelled fields with the buttons at the bottom (new / edit pages). */
export function FormSkeleton({ cards = 2, title }: { cards?: number; title?: boolean }) {
  return (
    <>
      {title && <Skeleton className="h-8 w-64" />}
      {Array.from({ length: cards }, (_, c) => (
        <Card key={c}>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <div className="flex justify-end gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-32" />
      </div>
    </>
  );
}

/** The sidebar while the user's menu loads (no sidebar context available here). */
export function SidebarSkeleton() {
  return (
    <div aria-hidden className="hidden w-(--sidebar-width) shrink-0 flex-col gap-2 border-r bg-sidebar p-3 md:flex">
      <div className="flex items-center gap-2 p-1">
        <Skeleton className="size-8 rounded-lg" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
