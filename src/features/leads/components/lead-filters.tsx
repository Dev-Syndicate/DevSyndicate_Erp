import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LEAD_SOURCES, LEAD_STATUSES, OPEN_STATUSES } from "@/features/leads/schema";

const ALL = "all"; // Select items can't have an empty value; the page ignores "all"
const STATUS_OPTIONS = LEAD_STATUSES.filter((s) => OPEN_STATUSES.includes(s.value));

type Filters = { q: string; view: string; source: string; status: string; addedBy: string };

/** Plain GET form: the URL holds the filters. The Won and Lost views already fix the status, so they hide it. */
export function LeadFilters({ f, users }: { f: Filters; users: { id: string; full_name: string; email: string }[] }) {
  const closed = f.view === "won" || f.view === "lost";
  return (
    <Card size="sm">
      <CardContent>
        {/* Reset is a client navigation: the key remounts the form so the fields show the new URL. */}
        <form key={JSON.stringify(f)} className="flex flex-wrap items-end gap-4">
          {f.view !== "open" && <input type="hidden" name="view" value={f.view} />}
          <Field className="w-full max-w-sm">
            <FieldLabel htmlFor="q">Search</FieldLabel>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="q" name="q" defaultValue={f.q} placeholder="Name, company, email, phone" className="pl-8" />
            </div>
          </Field>
          <Field className="w-40">
            <FieldLabel htmlFor="source">Source</FieldLabel>
            <Select name="source" defaultValue={f.source || ALL}>
              <SelectTrigger id="source" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All sources</SelectItem>
                {LEAD_SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {!closed && (
            <Field className="w-36">
              <FieldLabel htmlFor="status">Status</FieldLabel>
              <Select name="status" defaultValue={f.status || ALL}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field className="w-48">
            <FieldLabel htmlFor="added_by">Added by</FieldLabel>
            <Select name="added_by" defaultValue={f.addedBy || ALL}>
              <SelectTrigger id="added_by" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Anyone</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button type="submit">Apply</Button>
          <Button variant="ghost" asChild>
            <Link href={f.view === "open" ? "/leads" : `/leads?view=${f.view}`}>Reset</Link>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
