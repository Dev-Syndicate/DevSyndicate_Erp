"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/features/auth/actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {});

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Forgot password</CardTitle>
        <CardDescription>
          {state.sent
            ? "If an account exists for that email, a link to set a new password is on its way. It works once and expires in 24 hours."
            : "Enter your email and we'll send you a link to set a new password."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state.sent ? (
          <Button variant="outline" className="w-full" asChild>
            <Link href="/login">Back to sign in</Link>
          </Button>
        ) : (
          <form action={action}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" name="email" type="email" autoComplete="email" required />
              </Field>
              {state.error && <FieldError>{state.error}</FieldError>}
              <Button type="submit" disabled={pending}>
                {pending ? "Sending…" : "Send link"}
              </Button>
              <Link href="/login" className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
                Back to sign in
              </Link>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
