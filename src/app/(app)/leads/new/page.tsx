import { Suspense } from "react";
import { FormSkeleton } from "@/components/page-skeletons";
import { getCurrentUser } from "@/features/auth/queries";
import { LeadForm } from "@/features/leads/components/lead-form";
import { getLeadOwners } from "@/features/leads/queries";

// RLS rejects the insert for users without leads.create; the form shows that error.
async function NewLead() {
  const user = await getCurrentUser();
  const owners = user?.permissions.includes("leads.view_all") ? await getLeadOwners() : undefined;
  return <LeadForm owners={owners} />;
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
