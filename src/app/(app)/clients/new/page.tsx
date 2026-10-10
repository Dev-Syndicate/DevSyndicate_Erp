import { ClientForm } from "@/features/clients/components/client-form";

// RLS rejects the insert for users without clients.create; the form shows that error.
export default function NewClientPage() {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">New client</h1>
      <ClientForm />
    </>
  );
}
