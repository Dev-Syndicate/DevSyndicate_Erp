import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { POST_STATUSES } from "@/features/blog/schema";

const ALL = "all"; // Select items can't have an empty value; the page ignores "all"

type Filters = { q: string; category: string; status: string };

/** Plain GET form: the URL holds the filters. */
export function PostFilters({ f, categories }: { f: Filters; categories: { id: string; name: string }[] }) {
  return (
    <Card size="sm">
      <CardContent>
        <form key={JSON.stringify(f)} className="flex flex-wrap items-end gap-4">
          <Field className="w-full max-w-sm">
            <FieldLabel htmlFor="q">Search</FieldLabel>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="q" name="q" defaultValue={f.q} placeholder="Title" className="pl-8" />
            </div>
          </Field>
          <Field className="w-48">
            <FieldLabel htmlFor="category">Category</FieldLabel>
            <Select name="category" defaultValue={f.category || ALL}>
              <SelectTrigger id="category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field className="w-36">
            <FieldLabel htmlFor="status">Status</FieldLabel>
            <Select name="status" defaultValue={f.status || ALL}>
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {POST_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button type="submit" variant="secondary">
            Apply
          </Button>
          {(f.q || f.category || f.status) && (
            <Button variant="ghost" asChild>
              <Link href="/blog/posts">Reset</Link>
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
