import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FormSkeleton } from "@/components/page-skeletons";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/features/auth/queries";
import { getExpenseCategories } from "@/features/settings/queries";
import { setVendorArchived } from "@/features/vendors/actions";
import { VendorForm } from "@/features/vendors/components/vendor-form";
import { getVendor } from "@/features/vendors/queries";

async function EditVendor({ params }: { params: PageProps<"/vendors/[id]/edit">["params"] }) {
  const { id } = await params;
  const [vendor, categories, user] = await Promise.all([
    getVendor(id).catch(() => null),
    getExpenseCategories(),
    getCurrentUser(),
  ]);
  if (!vendor) notFound();
  const archived = !!vendor.deleted_at;
  const can = (p: string) => !!user?.permissions.includes(p);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{vendor.name}</h1>
        {archived && <Badge variant="outline">Archived</Badge>}
        {can("vendors.delete") && (
          <div className="ml-auto">
            <ConfirmButton
              action={setVendorArchived.bind(null, vendor.id, !archived)}
              title={archived ? "Restore vendor?" : "Archive vendor?"}
              description={archived ? "The vendor will appear in lists again." : "The vendor will be hidden from lists but kept for records."}
              confirmLabel={archived ? "Restore" : "Archive"}
              successMessage={archived ? "Vendor restored" : "Vendor archived"}
              variant="outline"
            >
              {archived ? "Restore" : "Archive"}
            </ConfirmButton>
          </div>
        )}
      </div>
      <VendorForm
        vendor={vendor}
        categories={categories.filter((c) => c.is_active || c.id === vendor.default_expense_category_id)}
        readOnly={archived || !can("vendors.update")}
      />
    </>
  );
}

export default function EditVendorPage({ params }: PageProps<"/vendors/[id]/edit">) {
  return (
    <Suspense fallback={<FormSkeleton title />}>
      <EditVendor params={params} />
    </Suspense>
  );
}
