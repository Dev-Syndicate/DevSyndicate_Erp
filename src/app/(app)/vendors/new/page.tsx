import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getExpenseCategories } from "@/features/settings/queries";
import { VendorForm } from "@/features/vendors/components/vendor-form";

async function NewVendor() {
  const categories = (await getExpenseCategories()).filter((c) => c.is_active);
  return <VendorForm categories={categories} />;
}

export default function NewVendorPage() {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">New vendor</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <NewVendor />
      </Suspense>
    </>
  );
}
