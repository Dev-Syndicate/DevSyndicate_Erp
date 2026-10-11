import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FormSkeleton } from "@/components/page-skeletons";
import { ExpenseForm } from "@/features/expenses/components/expense-form";
import { getExpense, getExpenseFormData } from "@/features/expenses/queries";
import { getDocuments } from "@/lib/documents/queries";

async function EditExpense({ params }: { params: PageProps<"/finance/expenses/[id]/edit">["params"] }) {
  const { id } = await params;
  const expense = await getExpense(id).catch(() => null);
  if (!expense) notFound();
  const [data, receipts] = await Promise.all([getExpenseFormData(expense), getDocuments("expense", id).catch(() => [])]);

  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Edit expense {expense.number}</h1>
      <ExpenseForm key={expense.updated_at} {...data} expense={expense} receipts={receipts} />
    </>
  );
}

export default function EditExpensePage({ params }: PageProps<"/finance/expenses/[id]/edit">) {
  return (
    <Suspense fallback={<FormSkeleton title />}>
      <EditExpense params={params} />
    </Suspense>
  );
}
