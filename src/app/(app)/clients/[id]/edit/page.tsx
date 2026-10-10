import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientForm } from "@/features/clients/components/client-form";
import { getClient } from "@/features/clients/queries";

async function EditClient({ params }: { params: PageProps<"/clients/[id]/edit">["params"] }) {
  const client = await getClient((await params).id).catch(() => null);
  if (!client) notFound();
  return <ClientForm client={client} />;
}

export default function EditClientPage({ params }: PageProps<"/clients/[id]/edit">) {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Edit client</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <EditClient params={params} />
      </Suspense>
    </>
  );
}
