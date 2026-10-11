import Link from "next/link";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AuditFilters as Filters } from "@/features/audit-logs/queries";
import { ACTIONS, MODULES } from "@/features/audit-logs/utils";

const ALL = "all"; // Select items can't have an empty value; the query ignores "all"

/** Plain GET form, like Zoho Books' activity log filters: module, user, action, dates. */
export function AuditFilters({ f, users }: { f: Filters; users: { id: string; full_name: string; email: string }[] }) {
  return (
    <Card size="sm">
      <CardContent>
        <form className="flex flex-wrap items-end gap-4">
          <Field className="w-48">
            <FieldLabel htmlFor="module">Module</FieldLabel>
            <Select name="module" defaultValue={f.module || ALL}>
              <SelectTrigger id="module" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All modules</SelectItem>
                {Object.entries(MODULES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field className="w-48">
            <FieldLabel htmlFor="user">User</FieldLabel>
            <Select name="user" defaultValue={f.user || ALL}>
              <SelectTrigger id="user" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All users</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </SelectItem>
                ))}
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field className="w-36">
            <FieldLabel htmlFor="action">Action</FieldLabel>
            <Select name="action" defaultValue={f.action || ALL}>
              <SelectTrigger id="action" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All actions</SelectItem>
                {Object.entries(ACTIONS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field className="w-40">
            <FieldLabel htmlFor="from">From</FieldLabel>
            <DatePicker id="from" name="from" defaultValue={f.from} clearable placeholder="Any date" />
          </Field>
          <Field className="w-40">
            <FieldLabel htmlFor="to">To</FieldLabel>
            <DatePicker id="to" name="to" defaultValue={f.to} clearable placeholder="Any date" />
          </Field>
          <Button type="submit">Apply</Button>
          <Button variant="ghost" asChild>
            <Link href="/settings/audit-logs">Reset</Link>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
