import { z } from "zod";

export const LEAD_SOURCES = [
  { value: "referral", label: "Referral", detail: "Who referred them" },
  { value: "linkedin", label: "LinkedIn", detail: "Profile or post link" },
  { value: "instagram", label: "Instagram", detail: "Handle or post link" },
  { value: "website", label: "Website", detail: "Page or campaign" },
  { value: "cold_outreach", label: "Cold outreach", detail: "Channel or campaign" },
  { value: "other", label: "Other", detail: "Where they came from" },
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

export type LeadStatus = (typeof LEAD_STATUSES)[number]["value"];
const label = (list: readonly { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;
export const sourceLabel = (v: string) => label(LEAD_SOURCES, v);
export const statusLabel = (v: string) => label(LEAD_STATUSES, v);
export const activityLabel = (v: string) => label(ACTIVITY_KINDS, v);

const optionalDate = z.union([z.literal(""), z.iso.date("Pick a date")]);

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
    lost_reason: z.string().trim().max(500),
    /** "" = keep the current owner (or you, for a new lead). */
    owner_id: z.union([z.literal(""), z.uuid()]),
    next_follow_up: optionalDate,
    follow_up_note: z.string().trim().max(500),
    notes: z.string().trim().max(5000),
  })
  .refine((l) => l.email || l.phone, { path: ["phone"], message: "Enter an email or a phone number" })
  .refine((l) => l.status !== "lost" || l.lost_reason, { path: ["lost_reason"], message: "Give the reason" });

export type LeadInput = z.input<typeof leadSchema>;

export const activitySchema = z.object({
  kind: z.enum(ACTIVITY_KINDS.map((k) => k.value)),
  body: z.string().trim().min(1, "Write what happened").max(5000),
  /** Replaces the lead's next follow-up; "" clears it. */
  next_follow_up: optionalDate,
  follow_up_note: z.string().trim().max(500),
});

export type ActivityInput = z.input<typeof activitySchema>;
