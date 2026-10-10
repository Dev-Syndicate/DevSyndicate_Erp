import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddItemForm } from "./add-item-form";
import { ArchiveButton } from "./archive-button";

type Row = { id: string; name: string; is_active: boolean; rate?: number };
type Props = { kind: "tax_rates" | "expense_categories"; rows: Row[]; canEdit: boolean };

/** Archivable name list shared by Tax Rates and Expense Categories. */
export function SettingsList({ kind, rows, canEdit }: Props) {
  const withRate = kind === "tax_rates";

  return (
    <Card className="max-w-2xl">
      <CardContent className="flex flex-col gap-4">
        {canEdit && <AddItemForm kind={kind} />}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              {withRate && <TableHead className="text-right">Rate</TableHead>}
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
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
