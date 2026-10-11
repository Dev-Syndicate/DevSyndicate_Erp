import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpenseForm } from "@/features/expenses/components/expense-form";
import { getExpense, getExpenseFormData } from "@/features/expenses/queries";

async function EditExpense({ params }: { params: PageProps<"/finance/expenses/[id]/edit">["params"] }) {
  const { id } = await params;
  const expense = await getExpense(id).catch(() => null);
  if (!expense) notFound();
  const data = await getExpenseFormData(expense);

  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Edit expense {expense.number}</h1>
      <ExpenseForm key={expense.updated_at} {...data} expense={expense} />
    </>
  );
}

export default function EditExpensePage({ params }: PageProps<"/finance/expenses/[id]/edit">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <EditExpense params={params} />
    </Suspense>
  );
}
