import { Suspense } from "react";
import { FormSkeleton } from "@/components/page-skeletons";
import { OwnerForm } from "@/features/owner/components/owner-form";
import { createClient } from "@/lib/supabase/server";

async function NewOwnerTransaction() {
  const supabase = await createClient();
  const { data: org } = await supabase.rpc("current_org_id");
  return <OwnerForm organizationId={org ?? ""} />;
}

export default function NewOwnerTransactionPage() {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Record drawing or capital</h1>
      <Suspense fallback={<FormSkeleton />}>
        <NewOwnerTransaction />
      </Suspense>
    </>
  );
}
