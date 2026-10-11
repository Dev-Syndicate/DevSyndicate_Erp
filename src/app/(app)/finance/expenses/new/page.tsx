import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpenseForm } from "@/features/expenses/components/expense-form";
import { getExpenseFormData } from "@/features/expenses/queries";

async function NewExpense() {
  const data = await getExpenseFormData();
  return <ExpenseForm {...data} />;
}

export default function NewExpensePage() {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Record expense</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <NewExpense />
      </Suspense>
    </>
  );
}
