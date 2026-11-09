import Link from "next/link";
import { Search } from "lucide-react";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LEAD_SOURCES, LEAD_STATUSES, OPEN_STATUSES } from "@/features/leads/schema";
import { istToday } from "@/lib/dates";
import { periodRange } from "@/lib/periods";

const ALL = "all"; // Select items can't have an empty value; the page ignores "all"
const STATUS_OPTIONS = LEAD_STATUSES.filter((s) => OPEN_STATUSES.includes(s.value));
const RANGES = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
];

type Filters = { q: string; view: string; source: string; status: string; addedBy: string; from: string; to: string; custom: boolean };

/** Plain GET form: the URL holds the filters. The Won and Lost views already fix the status, so they hide it. */
export function LeadFilters({ f, users, datesHref }: { f: Filters; users: { id: string; full_name: string; email: string }[]; datesHref: (dates: Record<string, string>) => string }) {
  const closed = f.view === "won" || f.view === "lost";
  const today = istToday();
  // Dates that aren't one of the quick picks came from the pickers, so keep those open.
  const custom = f.custom || ((!!f.from || !!f.to) && !RANGES.some((r) => { const range = periodRange(r.value, today); return range.from === f.from && range.to === f.to; }));
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
              <Input id="q" name="q" defaultValue={f.q} placeholder="Name, company, email, phone, handle" className="pl-8" />
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
          <Field className="w-auto">
            <FieldTitle>Added</FieldTitle>
            <div role="group" aria-label="Added" className="flex flex-wrap gap-1">
              <Button variant={!f.from && !f.to && !custom ? "secondary" : "ghost"} asChild>
                <Link href={datesHref({})}>Any time</Link>
              </Button>
              {RANGES.map((r) => {
                const range = periodRange(r.value, today);
                return (
                  <Button key={r.value} variant={range.from === f.from && range.to === f.to ? "secondary" : "ghost"} asChild>
                    <Link href={datesHref(range)}>{r.label}</Link>
                  </Button>
                );
              })}
              <Button variant={custom ? "secondary" : "ghost"} asChild>
                <Link href={datesHref({ custom: "1" })}>Custom</Link>
              </Button>
            </div>
          </Field>
          {custom && (
            <>
              <Field className="w-40">
                <FieldLabel htmlFor="from">From</FieldLabel>
                <DatePicker id="from" name="from" defaultValue={f.from} clearable placeholder="Any date" />
              </Field>
              <Field className="w-40">
                <FieldLabel htmlFor="to">To</FieldLabel>
                <DatePicker id="to" name="to" defaultValue={f.to} clearable placeholder="Any date" />
              </Field>
            </>
          )}
          <Button type="submit">Apply</Button>
          <Button variant="ghost" asChild>
            <Link href={f.view === "open" ? "/leads" : `/leads?view=${f.view}`}>Reset</Link>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
