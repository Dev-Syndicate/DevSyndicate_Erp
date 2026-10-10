import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddItemForm } from "./add-item-form";
import { ArchiveButton } from "./archive-button";

type Row = { id: string; name: string; is_active: boolean; rate?: number };
type Props = { kind: "tax_rates" | "expense_categories"; rows: Row[]; canEdit: boolean };

const DESCRIPTIONS = {
  tax_rates: "Rates you can pick on quotation and invoice lines. Archived rates stay on past documents but can't be picked.",
  expense_categories: "Used to group expenses in reports. Archived categories stay on past expenses but can't be picked.",
};

/** Archivable name list shared by Tax Rates and Expense Categories. */
export function SettingsList({ kind, rows, canEdit }: Props) {
  const withRate = kind === "tax_rates";
  const active = rows.filter((r) => r.is_active).length;

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center gap-4">
        <CardDescription className="max-w-xl">
          {DESCRIPTIONS[kind]} {active} of {rows.length} active.
        </CardDescription>
        {canEdit && (
          <CardAction className="ml-auto">
            <AddItemForm kind={kind} />
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              {withRate && <TableHead className="w-32 text-right">Rate</TableHead>}
              <TableHead className="w-40">Status</TableHead>
              {canEdit && <TableHead className="w-32 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Nothing here yet. Add the first one above.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.id} className={row.is_active ? undefined : "text-muted-foreground"}>
                <TableCell className="font-medium">{row.name}</TableCell>
                {withRate && <TableCell className="text-right tabular-nums">{row.rate}%</TableCell>}
                <TableCell>
                  <Badge variant={row.is_active ? "secondary" : "outline"}>{row.is_active ? "Active" : "Archived"}</Badge>
                </TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <ArchiveButton table={kind} id={row.id} isActive={row.is_active} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
