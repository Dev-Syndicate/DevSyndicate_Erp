import { z } from "zod";

export const LEAD_SOURCES = [
  { value: "referral", label: "Referral", detail: "Who referred them", example: "Karthik from Brightline" },
  { value: "linkedin", label: "LinkedIn", detail: "Profile or post link", example: "linkedin.com/in/asharao" },
  { value: "instagram", label: "Instagram", detail: "Handle or post link", example: "@raostudio" },
  { value: "website", label: "Website", detail: "Page or campaign", example: "Contact page" },
  { value: "cold_outreach", label: "Cold outreach", detail: "Channel or campaign", example: "Email campaign, Oct" },
  { value: "other", label: "Other", detail: "Where they came from", example: "Met at a meetup" },
] as const;

export const LEAD_STATUSES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "lost", label: "Lost" },
  { value: "won", label: "Won" },
] as const;

export const ACTIVITY_KINDS = [
  { value: "call", label: "Call" },
  { value: "meeting", label: "Meeting" },
  { value: "email", label: "Email" },
  { value: "message", label: "WhatsApp / DM" },
  { value: "note", label: "Note" },
] as const;

export const CALL_OUTCOMES = [
  { value: "reached", label: "Reached" },
  { value: "no_answer", label: "No answer" },
  { value: "busy", label: "Busy" },
  { value: "wrong_number", label: "Wrong number" },
] as const;

export const LOST_REASONS = [
  { value: "not_interested", label: "Not interested" },
  { value: "budget", label: "Budget" },
  { value: "chose_competitor", label: "Chose another agency" },
  { value: "no_response", label: "No response" },
  { value: "not_a_fit", label: "Not a fit" },
  { value: "bad_timing", label: "Bad timing" },
  { value: "wrong_contact", label: "Wrong contact details" },
  { value: "other", label: "Other" },
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number]["value"];
const label = (list: readonly { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;
export const sourceLabel = (v: string) => label(LEAD_SOURCES, v);
export const statusLabel = (v: string) => label(LEAD_STATUSES, v);
export const activityLabel = (v: string) => label(ACTIVITY_KINDS, v);
export const outcomeLabel = (v: string) => label(CALL_OUTCOMES, v);
export const lostReasonLabel = (v: string) => label(LOST_REASONS, v);
export const OPEN_STATUSES = ["new", "contacted", "qualified"];

const optionalDate = z.union([z.literal(""), z.iso.date("Pick a date")]);

const lostReason = z.enum(LOST_REASONS.map((r) => r.value), { error: "Choose a reason" });
// Lost rules (mirror the CHECKs on public.leads): Other needs a note, Bad timing needs a try-again date.
type Lost = { lost_reason: string; lost_note: string; next_follow_up: string };
const otherHasNote = (l: Lost) => l.lost_reason !== "other" || !!l.lost_note;
const badTimingHasDate = (l: Lost) => l.lost_reason !== "bad_timing" || !!l.next_follow_up;
const NOTE = { path: ["lost_note"], message: "Say why" };
const DATE = { path: ["next_follow_up"], message: "Pick when to try again" };

// Mirrors the CHECK constraints on public.leads (PRD §47). Won is set only by convert_lead.
export const leadSchema = z
  .object({
    name: z.string().trim().min(1, "Required").max(200),
    company: z.string().trim().max(200),
    email: z.string().trim().toLowerCase().pipe(z.union([z.literal(""), z.email("Invalid email")])),
    phone: z.string().trim().max(30),
    source: z.enum(LEAD_SOURCES.map((s) => s.value)),
    source_detail: z.string().trim().max(500),
    status: z.enum(["new", "contacted", "qualified", "lost"]),
    lost_reason: z.union([z.literal(""), lostReason]),
    lost_note: z.string().trim().max(500),
    next_follow_up: optionalDate,
    follow_up_note: z.string().trim().max(500),
    notes: z.string().trim().max(5000),
  })
  .refine((l) => l.email || l.phone, { path: ["phone"], message: "Enter an email or a phone number" })
  .refine((l) => l.status !== "lost" || l.lost_reason, { path: ["lost_reason"], message: "Choose the reason" })
  .refine((l) => l.status !== "lost" || otherHasNote(l), NOTE)
  .refine((l) => l.status !== "lost" || badTimingHasDate(l), DATE);

export type LeadInput = z.input<typeof leadSchema>;

/**
 * Form values → table row: lost fields only on Lost leads, and a follow-up date only on open leads or as the
 * Bad timing try-again date (PRD §47). Used by the app and the Claude connector.
 */
export function leadRow(l: z.output<typeof leadSchema>) {
  const lost = l.status === "lost";
  const keepDate = !lost || l.lost_reason === "bad_timing";
  return {
    ...l,
    lost_reason: lost ? l.lost_reason || null : null,
    lost_note: lost ? l.lost_note : "",
    next_follow_up: keepDate ? l.next_follow_up || null : null,
    follow_up_note: keepDate ? l.follow_up_note : "",
  };
}

/** Mark as lost: the reason, optional detail, and for Bad timing the date to try again. */
export const lostSchema = z
  .object({ lost_reason: lostReason, lost_note: z.string().trim().max(500), next_follow_up: optionalDate })
  .refine(otherHasNote, NOTE)
  .refine(badTimingHasDate, DATE);

export type LostInput = z.input<typeof lostSchema>;

export const activitySchema = z
  .object({
    kind: z.enum(ACTIVITY_KINDS.map((k) => k.value)),
    /** Calls only: only "reached" counts as contact (PRD §47). */
    outcome: z.union([z.literal(""), z.enum(CALL_OUTCOMES.map((o) => o.value))]),
    body: z.string().trim().min(1, "Write what happened").max(5000),
    /** Replaces the lead's next follow-up; "" clears it. */
    next_follow_up: optionalDate,
    follow_up_note: z.string().trim().max(500),
  })
  .refine((a) => a.kind !== "call" || a.outcome, { path: ["outcome"], message: "How did the call go?" });

export type ActivityInput = z.input<typeof activitySchema>;
