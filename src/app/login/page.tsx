import { Suspense } from "react";
import type { Metadata } from "next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { brand } from "@/config/navigation";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "Sign in · DevSyndicate ERP" };

/** Shown when an invite / password link was already used or has expired (from /auth/confirm). */
async function LinkNotice({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { link } = await searchParams;
  if (link !== "expired") return null;
  return (
    <Alert className="max-w-sm">
      <AlertDescription>That link has expired or was already used. Ask your admin for a new one.</AlertDescription>
    </Alert>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6">
      <div className="flex items-center gap-2 font-semibold">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <brand.icon className="size-4" />
        </div>
        {brand.name} {brand.product}
      </div>
      <Suspense>
        <LinkNotice searchParams={searchParams} />
      </Suspense>
      <LoginForm />
    </main>
  );
}
