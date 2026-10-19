import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FormSkeleton } from "@/components/page-skeletons";
import { getCurrentUser } from "@/features/auth/queries";
import { LeadForm } from "@/features/leads/components/lead-form";
import { getLead, getLeadOwners } from "@/features/leads/queries";

async function EditLead({ params }: { params: PageProps<"/leads/[id]/edit">["params"] }) {
  const { id } = await params;
  const [lead, user] = await Promise.all([getLead(id).catch(() => null), getCurrentUser()]);
  // Won leads are read-only (PRD §47).
  if (!lead || lead.status === "won") notFound();
  const owners = user?.permissions.includes("leads.view_all") ? await getLeadOwners() : undefined;
  return <LeadForm lead={lead} owners={owners} />;
}

export default function EditLeadPage({ params }: PageProps<"/leads/[id]/edit">) {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Edit lead</h1>
      <Suspense fallback={<FormSkeleton />}>
        <EditLead params={params} />
      </Suspense>
    </>
  );
}
