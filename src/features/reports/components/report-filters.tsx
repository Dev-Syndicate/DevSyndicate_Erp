import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/date-picker";
import type { ReportName } from "@/features/reports/utils";
import { istToday } from "@/lib/dates";
import { PERIODS, periodRange } from "@/lib/periods";

type Params = { name: ReportName; from: string; to: string; clientId?: string; categoryId?: string };
const ALL = "all"; // Select items can't have an empty value

/** Plain GET form: the URL holds the filters, so a report can be bookmarked or shared. */
export function ReportFilters({ params, clients, categories }: { params: Params; clients: { id: string; company_name: string }[]; categories: { id: string; name: string }[] }) {
  const today = istToday();
  const dated = params.name !== "outstanding"; // outstanding is as of today
  const byClient = params.name === "outstanding" || params.name === "sales";
  const byCategory = params.name === "expenses";

  return (
    <Card size="sm">
      <CardContent>
        <form className="flex flex-wrap items-end gap-4">
          <input type="hidden" name="report" value={params.name} />
          {dated && (
            <>
              <Field className="w-40">
                <FieldLabel htmlFor="from">From</FieldLabel>
                <DatePicker id="from" name="from" defaultValue={params.from} />
              </Field>
              <Field className="w-40">
                <FieldLabel htmlFor="to">To</FieldLabel>
                <DatePicker id="to" name="to" defaultValue={params.to} />
              </Field>
            </>
          )}
          {byClient && (
            <Field className="w-56">
              <FieldLabel htmlFor="client">Client</FieldLabel>
              <Select name="client" defaultValue={params.clientId ?? ALL}>
                <SelectTrigger id="client" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All clients</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {byCategory && (
            <Field className="w-56">
              <FieldLabel htmlFor="category">Category (register)</FieldLabel>
              <Select name="category" defaultValue={params.categoryId ?? ALL}>
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
          )}
          {(dated || byClient) && <Button type="submit">Apply</Button>}
          {dated && (
            <div className="flex flex-wrap gap-1">
              {PERIODS.map((p) => {
                const r = periodRange(p.value, today);
                return (
                  <Button key={p.value} variant={r.from === params.from && r.to === params.to ? "secondary" : "ghost"} size="sm" asChild>
                    <Link href={`/finance/reports?${new URLSearchParams({ report: params.name, ...r })}`}>{p.label}</Link>
                  </Button>
                );
              })}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
