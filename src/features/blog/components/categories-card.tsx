import { Pencil, Plus, Tags } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyRow } from "@/components/list-controls";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteCategory } from "@/features/blog/actions";
import type { listCategories } from "@/features/blog/queries";
import { CategoryDialog } from "./category-dialog";

type Rows = Awaited<ReturnType<typeof listCategories>>;

export function CategoriesCard({ rows, canEdit }: { rows: Rows; canEdit: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center gap-4">
        <CardDescription className="max-w-xl">Each post belongs to one category. A category with posts can&apos;t be deleted until its posts move.</CardDescription>
        {canEdit && (
          <CardAction className="ml-auto">
            <CategoryDialog>
              <Button>
                <Plus /> New category
              </Button>
            </CategoryDialog>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="w-24 text-right">Posts</TableHead>
              {canEdit && <TableHead className="w-40 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <EmptyRow colSpan={4} icon={Tags} title="No categories yet" description="Add categories like Tech News, General News or Company News." />}
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="whitespace-normal">
                  <div className="flex flex-col">
                    <span className="font-medium">{c.name}</span>
                    {c.description && <span className="text-xs text-muted-foreground">{c.description}</span>}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{c.slug}</TableCell>
                <TableCell className="text-right tabular-nums">{c.posts}</TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <CategoryDialog category={c}>
                        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${c.name}`}>
                          <Pencil />
                        </Button>
                      </CategoryDialog>
                      <ConfirmButton
                        action={deleteCategory.bind(null, c.id)}
                        title={`Delete ${c.name}?`}
                        description={c.posts ? `It has ${c.posts} post(s). Move them to another category first.` : "This can't be undone."}
                        confirmLabel="Delete"
                        successMessage="Category deleted"
                        variant="ghost"
                        size="sm"
                      >
                        Delete
                      </ConfirmButton>
                    </div>
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
