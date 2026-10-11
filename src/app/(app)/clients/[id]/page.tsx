import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { DetailSkeleton } from "@/components/page-skeletons";
import { ConfirmButton } from "@/components/confirm-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/features/auth/queries";
import { setClientArchived } from "@/features/clients/actions";
import { ContactsCard } from "@/features/clients/components/contacts-card";
import { getClient } from "@/features/clients/queries";

async function ClientDetail({ params, searchParams }: PageProps<"/clients/[id]">) {
  const [{ id }, { contact }] = await Promise.all([params, searchParams]);
  const [client, user] = await Promise.all([getClient(id).catch(() => null), getCurrentUser()]);
  if (!client) notFound();
  const can = (p: string) => !!user?.permissions.includes(p);
  const archived = !!client.deleted_at;

  const details: [string, string][] = [
    ["Billing address", [client.billing_address, client.city, client.state, client.pin_code, client.country].filter(Boolean).join(", ")],
    ["GSTIN", client.gstin],
    ["Payment terms", client.payment_terms_days === null ? "Company default" : `${client.payment_terms_days} days`],
    ["Notes", client.notes],
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{client.company_name}</h1>
        {archived && <Badge variant="outline">Archived</Badge>}
        <div className="ml-auto flex gap-2">
          {can("clients.update") && !archived && (
            <Button variant="outline" asChild>
              <Link href={`/clients/${client.id}/edit`}>
                <Pencil /> Edit
              </Link>
            </Button>
          )}
          {can("clients.delete") && (
            <ConfirmButton
              action={setClientArchived.bind(null, client.id, !archived)}
              title={archived ? "Restore client?" : "Archive client?"}
              description={archived ? "The client will appear in lists again." : "The client will be hidden from lists but kept for records."}
              confirmLabel={archived ? "Restore" : "Archive"}
              successMessage={archived ? "Client restored" : "Client archived"}
              variant="outline"
            >
              {archived ? "Restore" : "Archive"}
            </ConfirmButton>
          )}
        </div>
      </div>
      {contact === "failed" && (
        <Alert variant="destructive">
          <AlertDescription>The client was created, but the contact could not be saved. Add it under Contacts.</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              {details.map(([label, value]) => (
                <div key={label} className={label === "Billing address" || label === "Notes" ? "sm:col-span-2" : undefined}>
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="whitespace-pre-line">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <ContactsCard clientId={client.id} contacts={client.client_contacts} canEdit={can("clients.update") && !archived} />
      </div>
    </>
  );
}

export default function ClientPage(props: PageProps<"/clients/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <ClientDetail {...props} />
    </Suspense>
  );
}
