import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { brand } from "@/config/navigation";
import { getCurrentUser } from "@/features/auth/queries";
import { ConsentForm } from "@/features/auth/components/consent-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Allow access · DevSyndicate ERP" };

// Supabase Auth's OAuth 2.1 server sends the user here (Authorization Path) when Claude asks to connect (PRD §48).
// The proxy sends signed-out users to /login first and back here afterwards.
async function Consent({ searchParams }: { searchParams: PageProps<"/oauth/consent">["searchParams"] }) {
  const { authorization_id } = await searchParams;
  if (typeof authorization_id !== "string") return <Problem text="This link is missing its request. Start connecting again from Claude." />;

  const supabase = await createClient();
  const [{ data, error }, user] = await Promise.all([supabase.auth.oauth.getAuthorizationDetails(authorization_id), getCurrentUser()]);
  if (error || !data) return <Problem text="This request has expired or was already used. Start connecting again from Claude." />;
  // Already allowed before: go straight back.
  if (!("authorization_id" in data)) redirect(data.redirect_url);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Allow {data.client.name} to use {brand.name} {brand.product}?</CardTitle>
        <CardDescription>
          It will act as you ({user?.email}{user?.roleName && `, ${user.roleName}`}) with exactly the permissions your role has.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <p>It can:</p>
        <ul className="list-disc pl-5 text-muted-foreground">
          <li>Find, add and update leads, log calls and mark leads as won</li>
          <li>Find clients and quotations, create draft quotations and edit drafts</li>
        </ul>
        <p className="text-muted-foreground">Everything it changes is recorded in the audit log under your name. It can&apos;t send quotations, touch invoices or payments, or delete anything.</p>
      </CardContent>
      <CardFooter className="justify-end">
        <ConsentForm authorizationId={data.authorization_id} />
      </CardFooter>
    </Card>
  );
}

function Problem({ text }: { text: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Can&apos;t connect</CardTitle>
        <CardDescription>{text}</CardDescription>
      </CardHeader>
    </Card>
  );
}

export default function ConsentPage({ searchParams }: PageProps<"/oauth/consent">) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <div className="flex items-center gap-2 font-semibold">
        <BrandLogo />
        {brand.name} {brand.product}
      </div>
      <div className="w-full max-w-md">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <Consent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
