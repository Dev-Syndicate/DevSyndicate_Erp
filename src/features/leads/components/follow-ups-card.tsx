import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { getMyDueFollowUps } from "@/features/leads/queries";
import { formatDate, istToday } from "@/lib/dates";

/** The signed-in user's lead follow-ups due today or overdue (PRD §47). */
export function FollowUpsCard({ rows }: { rows: Awaited<ReturnType<typeof getMyDueFollowUps>> }) {
  const today = istToday();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Follow-ups due</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/leads?view=due">View all</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing due today.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {rows.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link href={`/leads/${l.id}`} className="font-medium hover:underline">
                    {l.name}
                  </Link>
                  <span className="block truncate text-xs text-muted-foreground">{[l.company, l.follow_up_note].filter(Boolean).join(" · ")}</span>
                </div>
                <span className={l.next_follow_up! < today ? "shrink-0 text-sm text-destructive tabular-nums" : "shrink-0 text-sm tabular-nums"}>
                  {l.next_follow_up === today ? "Today" : formatDate(l.next_follow_up)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
