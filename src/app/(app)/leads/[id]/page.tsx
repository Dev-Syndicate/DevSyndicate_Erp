import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Pencil, Trash2 } from "lucide-react";
import { DetailSkeleton } from "@/components/page-skeletons";
import { ConfirmButton } from "@/components/confirm-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/features/auth/queries";
import { deleteLead } from "@/features/leads/actions";
import { ActivitiesCard } from "@/features/leads/components/activities-card";
import { ConvertLeadDialog } from "@/features/leads/components/convert-lead-dialog";
import { LeadStatusBadge } from "@/features/leads/components/lead-status-badge";
import { MarkLostDialog } from "@/features/leads/components/mark-lost-dialog";
import { getClientOptions, getLead, getLeadUsers } from "@/features/leads/queries";
import { lostReasonLabel, OPEN_STATUSES, sourceLabel } from "@/features/leads/schema";
import { formatDate, istToday } from "@/lib/dates";

async function LeadDetail({ params }: { params: PageProps<"/leads/[id]">["params"] }) {
  const { id } = await params;
  const [lead, user, users] = await Promise.all([getLead(id).catch(() => null), getCurrentUser(), getLeadUsers().catch(() => [])]);
  if (!lead) notFound();
  const can = (p: string) => !!user?.permissions.includes(p);
  const won = lead.status === "won";
  const lost = lead.status === "lost";
  const isOpen = OPEN_STATUSES.includes(lead.status);
  const clients = can("leads.convert") && !won ? await getClientOptions() : [];
  const people = new Map(users.map((u) => [u.id, u.full_name || u.email]));
  const due = !!lead.next_follow_up && lead.next_follow_up <= istToday();

  const details: [string, React.ReactNode][] = [
    ["Company", lead.company],
    ["Email", lead.email && <a href={`mailto:${lead.email}`} className="hover:underline">{lead.email}</a>],
    ["Phone", lead.phone && <a href={`tel:${lead.phone}`} className="hover:underline">{lead.phone}</a>],
    ["Source", [sourceLabel(lead.source), lead.source_detail].filter(Boolean).join(" · ")],
    ["Added by", [lead.created_by && people.get(lead.created_by), formatDate(lead.created_at)].filter(Boolean).join(" · ")],
    ...(lead.call_attempts ? [["Unanswered calls", `${lead.call_attempts} since the last time they picked up`] as [string, React.ReactNode]] : []),
    ...(lost
      ? [["Lost because", [lostReasonLabel(lead.lost_reason ?? ""), lead.lost_note].filter(Boolean).join(" · ")] as [string, React.ReactNode]]
      : []),
    ...(isOpen || lead.next_follow_up
      ? [
          [
            lost ? "Try again on" : "Next follow-up",
            lead.next_follow_up && (
              <span className={due ? "text-destructive" : undefined}>
                {formatDate(lead.next_follow_up)}
                {isOpen && lead.follow_up_note && ` · ${lead.follow_up_note}`}
              </span>
            ),
          ] as [string, React.ReactNode],
        ]
      : []),
    ...(won && lead.clients
      ? [["Client", <Link key="client" href={`/clients/${lead.client_id}`} className="hover:underline">{lead.clients.company_name}</Link>] as [string, React.ReactNode]]
      : []),
    ["Notes", lead.notes],
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{lead.name}</h1>
        <LeadStatusBadge status={lead.status} />
        <div className="ml-auto flex gap-2">
          {can("leads.update") && !won && (
            <Button variant="outline" asChild>
              <Link href={`/leads/${lead.id}/edit`}>
                <Pencil /> Edit
              </Link>
            </Button>
          )}
          {can("leads.delete") && !won && (
            <ConfirmButton
              action={deleteLead.bind(null, lead.id)}
              title="Delete lead?"
              description="The lead and its activity are removed. Use this for mistakes; mark real leads as Lost instead."
              confirmLabel="Delete"
              variant="outline"
              size="icon"
              aria-label="Delete lead"
            >
              <Trash2 />
            </ConfirmButton>
          )}
          {can("leads.update") && isOpen && <MarkLostDialog leadId={lead.id} />}
          {can("leads.convert") && !won && <ConvertLeadDialog leadId={lead.id} newName={lead.company || lead.name} clients={clients} />}
        </div>
      </div>
      {isOpen && !lead.next_follow_up && (
        <Alert>
          <CalendarClock />
          <AlertDescription>No next follow-up is set, so nobody will be reminded about this lead. Log what happened and pick a date.</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-4">
              {details.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="whitespace-pre-line wrap-anywhere">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <ActivitiesCard leadId={lead.id} activities={lead.lead_activities} people={people} canLog={can("leads.update") && !won} isOpen={isOpen} />
      </div>
    </>
  );
}

export default function LeadPage({ params }: PageProps<"/leads/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <LeadDetail params={params} />
    </Suspense>
  );
}
