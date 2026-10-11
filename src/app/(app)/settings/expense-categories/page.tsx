import { Suspense } from "react";
import { ListSkeleton } from "@/components/page-skeletons";
import { getCurrentUser } from "@/features/auth/queries";
import { SettingsList } from "@/features/settings/components/settings-list";
import { getExpenseCategories } from "@/features/settings/queries";

async function ExpenseCategories() {
  const [rows, user] = await Promise.all([getExpenseCategories(), getCurrentUser()]);
  return <SettingsList kind="expense_categories" rows={rows} canEdit={!!user?.permissions.includes("settings.update")} />;
}

export default function ExpenseCategoriesPage() {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Expense Categories</h1>
      <Suspense fallback={<ListSkeleton />}>
        <ExpenseCategories />
      </Suspense>
    </>
  );
}
