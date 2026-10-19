import { Suspense } from "react";
import { connection } from "next/server";
import { FormSkeleton } from "@/components/page-skeletons";
import { LeadForm } from "@/features/leads/components/lead-form";

// The date picker reads today's date, so render per request. RLS rejects the insert without leads.create.
async function NewLead() {
  await connection();
  return <LeadForm />;
}

export default function NewLeadPage() {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">New lead</h1>
      <Suspense fallback={<FormSkeleton />}>
        <NewLead />
      </Suspense>
    </>
  );
}
