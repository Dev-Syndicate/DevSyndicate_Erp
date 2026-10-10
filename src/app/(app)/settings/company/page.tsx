import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/features/auth/queries";
import { CompanyForm } from "@/features/settings/components/company-form";
import { getCompanySettings, getDocumentNumbering, getTaxRates } from "@/features/settings/queries";

async function CompanySettings() {
  const [settings, taxRates, numbering, user] = await Promise.all([
    getCompanySettings(),
    getTaxRates(),
    getDocumentNumbering(),
    getCurrentUser(),
  ]);
  if (!settings) return <p className="text-muted-foreground">You don&apos;t have access to company settings.</p>;

  return (
    <CompanyForm
      settings={settings}
      numbering={numbering}
      taxRates={taxRates.filter((t) => t.is_active || t.id === settings.default_tax_rate_id)}
      canEdit={!!user?.permissions.includes("settings.update")}
    />
  );
}

export default function CompanySettingsPage() {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Company</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <CompanySettings />
      </Suspense>
    </>
  );
}
