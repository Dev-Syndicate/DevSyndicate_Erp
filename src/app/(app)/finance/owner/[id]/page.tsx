import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { DetailSkeleton } from "@/components/page-skeletons";
import { ProofsCard } from "@/components/proofs-card";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/features/auth/queries";
import { deleteOwnerTransaction } from "@/features/owner/actions";
import { OwnerView } from "@/features/owner/components/owner-view";
import { getOwnerTransaction } from "@/features/owner/queries";
import { ownerKindLabel } from "@/features/owner/schema";
import { getDocuments } from "@/lib/documents/queries";
import { formatINR } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

async function OwnerDetail({ params }: { params: PageProps<"/finance/owner/[id]">["params"] }) {
  const { id } = await params;
  const supabase = await createClient();
  const [t, user, proofs, org] = await Promise.all([
    getOwnerTransaction(id).catch(() => null),
    getCurrentUser(),
    getDocuments("owner", id).catch(() => []),
    supabase.rpc("current_org_id"),
  ]);
  if (!t) notFound();
  const can = (perm: string) => !!user?.permissions.includes(perm);

  return (
    <>
      <div className="flex flex-wrap items-start gap-3">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {ownerKindLabel(t.kind)} {formatINR(t.amount)}
        </h1>
        <div className="ml-auto flex flex-wrap gap-2">
          {can("owner.update") && (
            <Button variant="outline" asChild>
              <Link href={`/finance/owner/${t.id}/edit`}>
                <Pencil /> Edit
              </Link>
            </Button>
          )}
          {can("owner.delete") && (
            <ConfirmButton
              action={deleteOwnerTransaction.bind(null, t.id)}
              title="Delete transaction?"
              description="It and its attached files are removed permanently, and the company balance changes back."
              confirmLabel="Delete"
              variant="outline"
            >
              Delete
            </ConfirmButton>
          )}
        </div>
      </div>
      <OwnerView t={t} />
      {org.data && (
        <ProofsCard
          entityType="owner"
          entityId={t.id}
          organizationId={org.data}
          title="Proof"
          description="A payment screenshot, ATM slip or bank statement line."
          proofs={proofs}
          canAdd={can("owner.create") || can("owner.update")}
          canRemove={can("owner.update")}
        />
      )}
    </>
  );
}

export default function OwnerTransactionPage({ params }: PageProps<"/finance/owner/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <OwnerDetail params={params} />
    </Suspense>
  );
}
