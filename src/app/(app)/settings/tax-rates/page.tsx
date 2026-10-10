import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/features/auth/queries";
import { SettingsList } from "@/features/settings/components/settings-list";
import { getTaxRates } from "@/features/settings/queries";

async function TaxRates() {
  const [rows, user] = await Promise.all([getTaxRates(), getCurrentUser()]);
  return <SettingsList kind="tax_rates" rows={rows} canEdit={!!user?.permissions.includes("settings.update")} />;
}

export default function TaxRatesPage() {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Tax Rates</h1>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <TaxRates />
      </Suspense>
    </>
  );
}
