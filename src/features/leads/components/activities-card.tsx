"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { logActivity } from "@/features/leads/actions";
import { ACTIVITY_KINDS, activityLabel, activitySchema, CALL_OUTCOMES, outcomeLabel, type ActivityInput } from "@/features/leads/schema";
import { addDays, istToday } from "@/lib/dates";
import { issuesByPath } from "@/components/document-form";
import type { Tables } from "@/lib/supabase/database.types";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

type Props = {
  leadId: string;
  activities: Tables<"lead_activities">[];
  /** id → name of whoever logged an activity. */
  people: Map<string, string>;
  /** Log form shown for open leads the user can edit. */
  canLog: boolean;
  /** Open lead: logging can set the next follow-up (a Lost lead keeps its own). */
  isOpen: boolean;
};

/** Timeline of calls, meetings and notes on a lead; logging one also sets the next follow-up (PRD §47). */
export function ActivitiesCard({ leadId, activities, people, canLog, isOpen }: Props) {
  const empty: ActivityInput = { kind: "call", outcome: "", body: "", next_follow_up: "", follow_up_note: "" };
  const [form, setForm] = useState<ActivityInput>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof ActivityInput>(name: K, value: ActivityInput[K]) => setForm((f) => ({ ...f, [name]: value }));
  // No answer / busy: suggest trying again tomorrow unless a follow-up is already picked.
  const setOutcome = (outcome: ActivityInput["outcome"]) =>
    setForm((f) => ({
      ...f,
      outcome,
      ...((outcome === "no_answer" || outcome === "busy") && isOpen && !f.next_follow_up && { next_follow_up: addDays(istToday(), 1), follow_up_note: "Call again" }),
    }));

  function submit() {
    const parsed = activitySchema.safeParse(form);
    if (!parsed.success) {
      setErrors(issuesByPath(parsed.error.issues));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await logActivity(leadId, form);
      if (result.error) toast.error(result.error);
      if (result.ok) {
        toast.success("Activity logged");
        setForm(empty);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {canLog && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <fieldset disabled={pending} className="contents">
              <FieldGroup className="grid gap-4 sm:grid-cols-[12rem_1fr]">
                <div className="flex flex-col gap-4">
                  <Field>
                    <FieldLabel htmlFor="activity-kind">Type</FieldLabel>
                    <Select value={form.kind} onValueChange={(v) => setForm((f) => ({ ...f, kind: v as ActivityInput["kind"], outcome: "" }))}>
                      <SelectTrigger id="activity-kind" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTIVITY_KINDS.map((k) => (
                          <SelectItem key={k.value} value={k.value}>
                            {k.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  {form.kind === "call" && (
                    <Field data-invalid={!!errors.outcome}>
                      <FieldLabel htmlFor="activity-outcome">Outcome</FieldLabel>
                      <Select value={form.outcome || undefined} onValueChange={(v) => setOutcome(v as ActivityInput["outcome"])}>
                        <SelectTrigger id="activity-outcome" className="w-full" aria-invalid={!!errors.outcome}>
                          <SelectValue placeholder="How did it go?" />
                        </SelectTrigger>
                        <SelectContent>
                          {CALL_OUTCOMES.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError>{errors.outcome}</FieldError>
                    </Field>
                  )}
                </div>
                <Field data-invalid={!!errors.body}>
                  <FieldLabel htmlFor="activity-body">What happened</FieldLabel>
                  <Textarea id="activity-body" value={form.body} onChange={(e) => set("body", e.target.value)} rows={2} placeholder="e.g. Called, interested in a website redesign, wants a quote by Friday" aria-invalid={!!errors.body} />
                  <FieldError>{errors.body}</FieldError>
                  {form.outcome === "wrong_number" && (
                    <FieldDescription>Fix the phone number with Edit, or mark the lead as lost (Wrong contact details).</FieldDescription>
                  )}
                </Field>
                {isOpen && (
                <>
                <Field>
                  <FieldLabel htmlFor="activity-next">Next follow-up</FieldLabel>
                  <DatePicker id="activity-next" value={form.next_follow_up} onChange={(v) => set("next_follow_up", v)} clearable placeholder="None" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="activity-note">What to do next</FieldLabel>
                  <Input id="activity-note" value={form.follow_up_note} onChange={(e) => set("follow_up_note", e.target.value)} disabled={!form.next_follow_up} placeholder="e.g. Send the proposal" />
                  <FieldDescription>Replaces the lead&apos;s next follow-up; leave the date empty if there is none.</FieldDescription>
                </Field>
                </>
                )}
              </FieldGroup>
              <div className="mt-4 flex justify-end">
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Log activity"}
                </Button>
              </div>
            </fieldset>
          </form>
        )}

        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ol className="flex flex-col divide-y">
            {activities.map((a) => (
              <li key={a.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <span className="text-sm font-medium">
                  {activityLabel(a.kind)}
                  {a.outcome && <span className={a.outcome === "reached" ? undefined : "text-warning"}>{` · ${outcomeLabel(a.outcome)}`}</span>}
                  <span className="font-normal text-muted-foreground">
                    {" · "}
                    {when(a.happened_at)}
                    {a.created_by && people.get(a.created_by) && ` · ${people.get(a.created_by)}`}
                  </span>
                </span>
                <p className="text-sm whitespace-pre-line">{a.body}</p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
