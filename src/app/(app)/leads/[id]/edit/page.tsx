import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FormSkeleton } from "@/components/page-skeletons";
import { LeadForm } from "@/features/leads/components/lead-form";
import { getLead } from "@/features/leads/queries";

async function EditLead({ params }: { params: PageProps<"/leads/[id]/edit">["params"] }) {
  const lead = await getLead((await params).id).catch(() => null);
  // Won leads are read-only (PRD §47).
  if (!lead || lead.status === "won") notFound();
  return <LeadForm lead={lead} />;
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
