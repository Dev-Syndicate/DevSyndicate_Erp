"use client";

import { DatePicker } from "@/components/date-picker";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LOST_REASONS } from "@/features/leads/schema";
import { addDays, istToday } from "@/lib/dates";

type Value = { lost_reason: string; lost_note: string; next_follow_up: string };

/** Reason from the list, optional note (required for Other), and for Bad timing the date to try again (PRD §47). */
export function LostFields({ value, onChange, errors }: { value: Value; onChange: (name: keyof Value, v: string) => void; errors: Record<string, string> }) {
  return (
    <>
      <Field data-invalid={!!errors.lost_reason}>
        <FieldLabel htmlFor="lost_reason">Why was it lost?</FieldLabel>
        <Select value={value.lost_reason || undefined} onValueChange={(v) => onChange("lost_reason", v)}>
          <SelectTrigger id="lost_reason" className="w-full" aria-invalid={!!errors.lost_reason}>
            <SelectValue placeholder="Choose a reason" />
          </SelectTrigger>
          <SelectContent>
            {LOST_REASONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError>{errors.lost_reason}</FieldError>
      </Field>
      <Field data-invalid={!!errors.lost_note}>
        <FieldLabel htmlFor="lost_note">Details</FieldLabel>
        <Input
          id="lost_note"
          value={value.lost_note}
          onChange={(e) => onChange("lost_note", e.target.value)}
          placeholder={value.lost_reason === "other" ? "Required for Other" : "Optional, e.g. went with a cheaper freelancer"}
          aria-invalid={!!errors.lost_note}
        />
        <FieldError>{errors.lost_note}</FieldError>
      </Field>
      {value.lost_reason === "bad_timing" && (
        <Field data-invalid={!!errors.next_follow_up}>
          <FieldLabel htmlFor="try_again">Try again on</FieldLabel>
          <DatePicker id="try_again" value={value.next_follow_up} onChange={(v) => onChange("next_follow_up", v)} min={addDays(istToday(), 1)} placeholder="Pick a date" aria-invalid={!!errors.next_follow_up} />
          <FieldDescription>The lead comes back in Follow-ups due on this date.</FieldDescription>
          <FieldError>{errors.next_follow_up}</FieldError>
        </Field>
      )}
    </>
  );
}
