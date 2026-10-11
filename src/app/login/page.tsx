import { Suspense } from "react";
import type { Metadata } from "next";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { brand } from "@/config/navigation";
import { LoginForm } from "@/features/auth/components/login-form";
import { ProductShowcase } from "@/features/auth/components/product-showcase";

export const metadata: Metadata = { title: "Sign in · DevSyndicate ERP" };

/** Expired invite / password link (from /auth/confirm) or an account deactivated while signed in (from /auth/inactive). */
async function LinkNotice({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { link, account } = await searchParams;
  if (account === "inactive") {
    return (
      <Alert variant="destructive">
        <AlertDescription>Your account is inactive. Ask your administrator to reactivate it.</AlertDescription>
      </Alert>
    );
  }
  if (link !== "expired") return null;
  return (
    <Alert>
      <AlertDescription>That link has expired or was already used. Ask your admin for a new one.</AlertDescription>
    </Alert>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex items-center gap-2 font-semibold">
          <BrandLogo />
          {brand.name} {brand.product}
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-xs flex-col gap-6">
            <Suspense>
              <LinkNotice searchParams={searchParams} />
            </Suspense>
            <LoginForm />
          </div>
        </div>
      </div>
      <ProductShowcase />
    </main>
  );
}
