import { History } from "lucide-react";
import { EmptyRow } from "@/components/list-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { listAuditLogs } from "@/features/audit-logs/queries";
import { ACTIONS, changes, MODULES, recordLabel } from "@/features/audit-logs/utils";

type Data = Awaited<ReturnType<typeof listAuditLogs>>;
type Json = Record<string, unknown> | null;

const when = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const TONE: Record<string, string> = {
  insert: "bg-success/15 text-success",
  update: "bg-info/15 text-info",
  delete: "bg-destructive/15 text-destructive",
};
const MAX_CHANGES = 6;

export function AuditTable({ rows, users }: Pick<Data, "rows" | "users">) {
  const userName = new Map(users.map((u) => [u.id, u.full_name || u.email]));

  return (
    <Card className="flex-1">
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Record</TableHead>
              <TableHead className="w-[40%]">Changes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <EmptyRow colSpan={5} icon={History} title="No activity" description="Nothing matches these filters." />}
            {rows.map((r) => {
              const op = r.action.split(".").pop() ?? "";
              const before = r.before as Json;
              const after = r.after as Json;
              const diff = changes(before, after);
              return (
                <TableRow key={r.id} className="align-top">
                  <TableCell className="whitespace-nowrap tabular-nums">{when.format(new Date(r.created_at))}</TableCell>
                  <TableCell>{r.actor_id ? (userName.get(r.actor_id) ?? "Unknown user") : <span className="text-muted-foreground">System</span>}</TableCell>
                  <TableCell>
                    <Badge className={TONE[op] ?? "bg-muted text-muted-foreground"}>{ACTIONS[op] ?? r.action}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{recordLabel(before, after, r.record_id)}</div>
                    <div className="text-xs text-muted-foreground">{MODULES[r.table_name ?? ""] ?? r.table_name}</div>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {diff.length === 0 ? (
                      <span className="text-muted-foreground">{r.reason || "—"}</span>
                    ) : (
                      <ul className="space-y-0.5 text-xs">
                        {diff.slice(0, MAX_CHANGES).map((c) => (
                          <li key={c.field}>
                            <span className="text-muted-foreground">{c.field}:</span> <span className="line-through decoration-muted-foreground/50">{c.from}</span> → {c.to}
                          </li>
                        ))}
                        {diff.length > MAX_CHANGES && <li className="text-muted-foreground">+{diff.length - MAX_CHANGES} more</li>}
                      </ul>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
