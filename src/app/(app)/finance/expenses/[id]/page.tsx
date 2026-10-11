import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { ProofsCard } from "@/components/proofs-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/features/auth/queries";
import { deleteExpense } from "@/features/expenses/actions";
import { ExpenseView } from "@/features/expenses/components/expense-view";
import { getExpense } from "@/features/expenses/queries";
import { getDocuments } from "@/lib/documents/queries";
import { formatINR } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

async function ExpenseDetail({ params }: { params: PageProps<"/finance/expenses/[id]">["params"] }) {
  const { id } = await params;
  const supabase = await createClient();
  const [e, user, receipts, org] = await Promise.all([
    getExpense(id).catch(() => null),
    getCurrentUser(),
    getDocuments("expense", id).catch(() => []),
    supabase.rpc("current_org_id"),
  ]);
  if (!e) notFound();
  const can = (perm: string) => !!user?.permissions.includes(perm);

  return (
    <>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Expense {formatINR(e.amount)}</h1>
          <span className="font-mono text-sm text-muted-foreground">{e.number}</span>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {can("expenses.update") && (
            <Button variant="outline" asChild>
              <Link href={`/finance/expenses/${e.id}/edit`}>
                <Pencil /> Edit
              </Link>
            </Button>
          )}
          {can("expenses.delete") && (
            <ConfirmButton
              action={deleteExpense.bind(null, e.id)}
              title="Delete expense?"
              description="The expense and its attached files are removed permanently. Its number is not reused."
              confirmLabel="Delete"
              variant="outline"
            >
              Delete
            </ConfirmButton>
          )}
        </div>
      </div>
      <ExpenseView e={e} />
      {org.data && (
        <ProofsCard
          entityType="expense"
          entityId={e.id}
          organizationId={org.data}
          title="Bill / receipt"
          description="The vendor's invoice, a receipt or a payment screenshot."
          proofs={receipts}
          canAdd={can("expenses.create") || can("expenses.update")}
          canRemove={can("expenses.update")}
        />
      )}
    </>
  );
}

export default function ExpensePage({ params }: PageProps<"/finance/expenses/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <ExpenseDetail params={params} />
    </Suspense>
  );
}
