import Link from "next/link";
import { UserRoundSearch } from "lucide-react";
import { EmptyRow } from "@/components/list-controls";
import { StatusTile } from "@/components/status-tile";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LeadStatusBadge, leadStatusClass } from "@/features/leads/components/lead-status-badge";
import type { listLeads } from "@/features/leads/queries";
import { sourceLabel } from "@/features/leads/schema";
import { formatDate, istToday } from "@/lib/dates";

type Rows = Awaited<ReturnType<typeof listLeads>>["rows"];

/** `owners` (id → name) is passed only to users who see everyone's leads; it adds the Owner column. */
export function LeadsTable({ rows, owners }: { rows: Rows; owners?: Map<string, string> }) {
  const today = istToday();
  const cols = owners ? 6 : 5;
  return (
    <Card className="flex-1">
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Lead</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Next follow-up</TableHead>
              {owners && <TableHead>Owner</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <EmptyRow colSpan={cols} icon={UserRoundSearch} title="No leads found" description="Leads you add appear here. If you searched or filtered, try another view." />
            )}
            {rows.map((l) => {
              const open = l.status !== "won" && l.status !== "lost";
              const due = open && !!l.next_follow_up && l.next_follow_up <= today;
              return (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <StatusTile icon={UserRoundSearch} className={leadStatusClass(l.status)} />
                      <div className="flex flex-col">
                        <Link href={`/leads/${l.id}`} className="hover:underline">
                          {l.name}
                        </Link>
                        {l.company && <span className="text-xs font-normal text-muted-foreground">{l.company}</span>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      <span>{l.phone}</span>
                      <span className="text-xs text-muted-foreground">{l.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{sourceLabel(l.source)}</TableCell>
                  <TableCell>
                    <LeadStatusBadge status={l.status} />
                  </TableCell>
                  <TableCell className={due ? "text-destructive tabular-nums" : "tabular-nums"}>
                    {open && l.next_follow_up ? (
                      <div className="flex flex-col">
                        <span>{formatDate(l.next_follow_up)}</span>
                        {l.follow_up_note && <span className="max-w-48 truncate text-xs text-muted-foreground">{l.follow_up_note}</span>}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  {owners && <TableCell className="text-muted-foreground">{owners.get(l.owner_id) ?? "—"}</TableCell>}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
