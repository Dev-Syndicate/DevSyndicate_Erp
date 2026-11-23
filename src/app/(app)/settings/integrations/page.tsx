import { Suspense } from "react";
import { FormSkeleton } from "@/components/page-skeletons";
import { getCurrentUser } from "@/features/auth/queries";
import { WebsiteFormCard } from "@/features/settings/components/website-form-card";
import { getCompanySettings } from "@/features/settings/queries";

async function Integrations() {
  const [settings, user] = await Promise.all([getCompanySettings(), getCurrentUser()]);
  if (!settings) return <p className="text-muted-foreground">You don&apos;t have access to settings.</p>;
  return <WebsiteFormCard hasKey={!!settings.website_form_key_hash} canEdit={!!user?.permissions.includes("settings.update")} />;
}

export default function IntegrationsPage() {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Integrations</h1>
      <Suspense fallback={<FormSkeleton cards={1} />}>
        <Integrations />
      </Suspense>
    </>
  );
}
