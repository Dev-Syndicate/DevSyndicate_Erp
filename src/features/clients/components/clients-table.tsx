import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { listClients } from "@/features/clients/queries";

type Rows = Awaited<ReturnType<typeof listClients>>["rows"];

export function ClientsTable({ rows }: { rows: Rows }) {
  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead>Primary contact</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No clients found.
                </TableCell>
              </TableRow>
            )}
            {rows.map((c) => {
              const primary = c.client_contacts.find((x) => x.is_primary) ?? c.client_contacts[0];
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link href={`/clients/${c.id}`} className="hover:underline">
                      {c.company_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{[c.city, c.state].filter(Boolean).join(", ")}</TableCell>
                  <TableCell className="font-mono text-xs">{c.gstin}</TableCell>
                  <TableCell>
                    {primary && (
                      <div className="flex flex-col">
                        <span>{primary.name}</span>
                        <span className="text-xs text-muted-foreground">{primary.email}</span>
                      </div>
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
