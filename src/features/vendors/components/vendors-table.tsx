import Link from "next/link";
import { Truck } from "lucide-react";
import { EmptyRow } from "@/components/list-controls";
import { StatusTile } from "@/components/status-tile";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { listVendors } from "@/features/vendors/queries";

type Rows = Awaited<ReturnType<typeof listVendors>>["rows"];

export function VendorsTable({ rows }: { rows: Rows }) {
  return (
    <Card className="flex-1">
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[35%]">Vendor</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead>Default category</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <EmptyRow colSpan={4} icon={Truck} title="No vendors found" description="Vendors you add appear here. If you searched, try a different name." />
            )}
            {rows.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <StatusTile icon={Truck} />
                    <Link href={`/vendors/${v.id}/edit`} className="hover:underline">
                      {v.name}
                    </Link>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{v.contact_person}</span>
                    <span className="text-xs text-muted-foreground">{v.email || v.phone}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{v.gstin}</TableCell>
                <TableCell className="text-muted-foreground">{v.expense_categories?.name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
