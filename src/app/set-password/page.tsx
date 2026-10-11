import { Suspense } from "react";
import type { Metadata } from "next";
import { BrandLogo } from "@/components/layout/brand-logo";
import { brand } from "@/config/navigation";
import { getCurrentUser } from "@/features/auth/queries";
import { SetPasswordForm } from "@/features/auth/components/set-password-form";

export const metadata: Metadata = { title: "Set password · DevSyndicate ERP" };

async function Form() {
  // Signed in by the invite / password link (the proxy sends signed-out visitors to /login).
  const user = await getCurrentUser();
  return <SetPasswordForm email={user?.email ?? ""} />;
}

export default function SetPasswordPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6">
      <div className="flex items-center gap-2 font-semibold">
        <BrandLogo />
        {brand.name} {brand.product}
      </div>
      <Suspense>
        <Form />
      </Suspense>
    </main>
  );
}
