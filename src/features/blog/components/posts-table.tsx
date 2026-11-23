import Link from "next/link";
import { Newspaper } from "lucide-react";
import { EmptyRow } from "@/components/list-controls";
import { StatusTile } from "@/components/status-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { listPosts } from "@/features/blog/queries";
import { formatDate } from "@/lib/dates";

type Rows = Awaited<ReturnType<typeof listPosts>>["rows"];

/** Timestamp → DD-MM-YYYY in IST (PRD §8). */
const istDate = (ts: string) => formatDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(ts)));

// Status colours come from theme tokens (CLAUDE.md rule 2).
export function PostStatusBadge({ status }: { status: string }) {
  return status === "published" ? <Badge className="bg-success/15 text-success">Published</Badge> : <Badge className="bg-warning/15 text-warning">Draft</Badge>;
}

export function PostsTable({ rows }: { rows: Rows }) {
  return (
    <Card className="flex-1">
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[45%]">Post</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <EmptyRow colSpan={5} icon={Newspaper} title="No posts found" description="Posts you or Claude write appear here. If you searched or filtered, try changing it." />
            )}
            {rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium whitespace-normal">
                  <div className="flex items-center gap-3">
                    <StatusTile icon={Newspaper} />
                    <div className="flex flex-col">
                      <Link href={`/blog/posts/${p.id}`} className="hover:underline">
                        {p.title}
                      </Link>
                      <span className="font-mono text-xs text-muted-foreground">{p.slug}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.blog_categories?.name}</TableCell>
                <TableCell>
                  <PostStatusBadge status={p.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">{p.published_at ? istDate(p.published_at) : "—"}</TableCell>
                <TableCell className="text-muted-foreground">{istDate(p.updated_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
