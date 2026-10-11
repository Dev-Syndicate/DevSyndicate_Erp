import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FormSkeleton } from "@/components/page-skeletons";
import { OwnerForm } from "@/features/owner/components/owner-form";
import { getOwnerTransaction } from "@/features/owner/queries";
import { ownerKindLabel } from "@/features/owner/schema";
import { getDocuments } from "@/lib/documents/queries";
import { createClient } from "@/lib/supabase/server";

async function EditOwnerTransaction({ params }: { params: PageProps<"/finance/owner/[id]/edit">["params"] }) {
  const { id } = await params;
  const supabase = await createClient();
  const [t, proofs, org] = await Promise.all([
    getOwnerTransaction(id).catch(() => null),
    getDocuments("owner", id).catch(() => []),
    supabase.rpc("current_org_id"),
  ]);
  if (!t) notFound();

  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Edit {ownerKindLabel(t.kind).toLowerCase()}</h1>
      <OwnerForm key={t.updated_at} organizationId={org.data ?? ""} transaction={t} proofs={proofs} />
    </>
  );
}

export default function EditOwnerTransactionPage({ params }: PageProps<"/finance/owner/[id]/edit">) {
  return (
    <Suspense fallback={<FormSkeleton title />}>
      <EditOwnerTransaction params={params} />
    </Suspense>
  );
}
