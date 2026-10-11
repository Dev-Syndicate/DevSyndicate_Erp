import type { Metadata } from "next";
import { brand } from "@/config/navigation";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password · DevSyndicate ERP" };

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6">
      <div className="flex items-center gap-2 font-semibold">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <brand.icon className="size-4" />
        </div>
        {brand.name} {brand.product}
      </div>
      <ForgotPasswordForm />
    </main>
  );
}
