import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DetailSkeleton } from "@/components/page-skeletons";
import { getCurrentUser } from "@/features/auth/queries";
import { CreditNoteActions } from "@/features/credit-notes/components/credit-note-actions";
import { CreditNoteStatusBadge } from "@/features/credit-notes/components/credit-note-status-badge";
import { CreditNoteView } from "@/features/credit-notes/components/credit-note-view";
import { getCreditNote } from "@/features/credit-notes/queries";
import { creditNoteLabel, type CreditNoteStatus } from "@/features/credit-notes/schema";
import { getCompanySettings } from "@/features/settings/queries";

async function CreditNoteDetail({ params }: { params: PageProps<"/finance/credit-notes/[id]">["params"] }) {
  const { id } = await params;
  const [cn, user, settings] = await Promise.all([getCreditNote(id).catch(() => null), getCurrentUser(), getCompanySettings()]);
  if (!cn) notFound();
  const status = cn.status as CreditNoteStatus;

  return (
    <>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">Credit note</h1>
            <CreditNoteStatusBadge status={status} />
          </div>
          <span className="font-mono text-sm text-muted-foreground">{creditNoteLabel(cn)}</span>
        </div>
        <div className="ml-auto">
          <CreditNoteActions id={cn.id} status={status} can={(p) => !!user?.permissions.includes(p)} />
        </div>
      </div>
      <CreditNoteView cn={cn} showSac={settings?.show_sac ?? false} />
    </>
  );
}

export default function CreditNotePage({ params }: PageProps<"/finance/credit-notes/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <CreditNoteDetail params={params} />
    </Suspense>
  );
}
