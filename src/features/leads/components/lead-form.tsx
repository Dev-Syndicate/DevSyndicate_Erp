"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { issuesByPath } from "@/components/document-form";
import { DatePicker } from "@/components/date-picker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveLead, type Duplicate } from "@/features/leads/actions";
import { LostFields } from "@/features/leads/components/lost-fields";
import { LEAD_SOURCES, LEAD_STATUSES, leadSchema, type LeadInput } from "@/features/leads/schema";
import type { Tables } from "@/lib/supabase/database.types";

export function LeadForm({ lead }: { lead?: Omit<Tables<"leads">, "call_attempts"> }) {
  const [form, setForm] = useState<LeadInput>(() => ({
    name: lead?.name ?? "",
    company: lead?.company ?? "",
    email: lead?.email ?? "",
    phone: lead?.phone ?? "",
    source: (lead?.source as LeadInput["source"]) ?? "referral",
    source_detail: lead?.source_detail ?? "",
    status: (lead?.status as LeadInput["status"]) ?? "new",
    lost_reason: (lead?.lost_reason as LeadInput["lost_reason"]) ?? "",
    lost_note: lead?.lost_note ?? "",
    next_follow_up: lead?.next_follow_up ?? "",
    follow_up_note: lead?.follow_up_note ?? "",
    notes: lead?.notes ?? "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof LeadInput>(name: K, value: LeadInput[K]) => {
    setForm((f) => ({ ...f, [name]: value }));
    setDuplicates([]);
  };
  const source = LEAD_SOURCES.find((s) => s.value === form.source);

  function submit(allowDuplicate: boolean) {
    const parsed = leadSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(issuesByPath(parsed.error.issues));
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setErrors({});
    startTransition(async () => {
      // Redirects to the lead on success.
      const result = await saveLead(lead?.id ?? null, form, allowDuplicate);
      setDuplicates(result.duplicates ?? []);
      if (result.fieldErrors) setErrors(result.fieldErrors);
      if (result.error) toast.error(result.error);
    });
  }

  const text = (name: "name" | "company" | "email" | "phone" | "source_detail", label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <Field data-invalid={!!errors[name]}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input id={name} value={form[name]} onChange={(e) => set(name, e.target.value)} aria-invalid={!!errors[name]} {...props} />
      <FieldError>{errors[name]}</FieldError>
    </Field>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
      className="flex flex-col gap-6"
    >
      <fieldset disabled={pending} className="contents">
        <Card>
          <CardHeader>
            <CardTitle>Lead</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              {text("name", "Name", { required: true, placeholder: "e.g. Asha Rao" })}
              {text("company", "Company", { placeholder: "e.g. Rao Studio (optional)" })}
              {text("email", "Email", { type: "email", placeholder: "e.g. asha@raostudio.in" })}
              {text("phone", "Phone", { type: "tel", placeholder: "e.g. +91 98450 12345" })}
              <Field>
                <FieldLabel htmlFor="source">Source</FieldLabel>
                <Select value={form.source} onValueChange={(v) => set("source", v as LeadInput["source"])}>
                  <SelectTrigger id="source" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {text("source_detail", source?.detail ?? "Source detail", { placeholder: `e.g. ${source?.example} (optional)` })}
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="status">Status</FieldLabel>
                <Select value={form.status} onValueChange={(v) => set("status", v as LeadInput["status"])}>
                  <SelectTrigger id="status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Won only through "Mark as won", which creates or links the client. */}
                    {LEAD_STATUSES.filter((s) => s.value !== "won").map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="hidden sm:block" />
              {form.status === "lost" ? (
                <LostFields value={form} onChange={(name, v) => set(name, v as never)} errors={errors} />
              ) : (
                <>
                  <Field data-invalid={!!errors.next_follow_up}>
                    <FieldLabel htmlFor="next_follow_up">Next follow-up</FieldLabel>
                    <DatePicker id="next_follow_up" value={form.next_follow_up} onChange={(v) => set("next_follow_up", v)} clearable placeholder="None" />
                    <FieldError>{errors.next_follow_up}</FieldError>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="follow_up_note">What to do</FieldLabel>
                    <Input id="follow_up_note" value={form.follow_up_note} onChange={(e) => set("follow_up_note", e.target.value)} placeholder="e.g. Send the proposal" />
                  </Field>
                </>
              )}
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="notes">Notes</FieldLabel>
                <Textarea id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder="e.g. Needs a 5-page site before Diwali; budget around ₹50,000" />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        {duplicates.length > 0 && (
          <Alert>
            <TriangleAlert />
            <AlertTitle>Someone with this email or phone already exists</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {duplicates.map((d, i) => (
                  <li key={i}>
                    {d.kind === "client" ? "Client contact" : "Lead"}: {d.name}
                    {d.detail && ` (${d.detail})`}
                  </li>
                ))}
              </ul>
              <p>Check it isn&apos;t the same person, or save anyway.</p>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" asChild>
            <Link href={lead ? `/leads/${lead.id}` : "/leads"}>Cancel</Link>
          </Button>
          {duplicates.length > 0 ? (
            <Button type="button" onClick={() => submit(true)} disabled={pending}>
              {pending ? "Saving…" : "Save anyway"}
            </Button>
          ) : (
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : lead ? "Save changes" : "Create lead"}
            </Button>
          )}
        </div>
      </fieldset>
    </form>
  );
}
