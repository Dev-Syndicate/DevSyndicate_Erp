"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrors, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { clientSchema, contactSchema } from "./schema";

const NO_PERMISSION = "You don't have permission to do this.";
const id = z.uuid();

function parseClient(formData: FormData) {
  return clientSchema.safeParse(Object.fromEntries(formData));
}

function parseContact(formData: FormData) {
  return contactSchema.safeParse({ ...Object.fromEntries(formData), is_primary: formData.get("is_primary") === "on" });
}

/** Optional primary contact on the create form (contact_* fields); null when left blank. */
function parseNewContact(formData: FormData) {
  const input = Object.fromEntries(
    ["name", "designation", "email", "phone"].map((f) => [f, String(formData.get(`contact_${f}`) ?? "")]),
  );
  if (!Object.values(input).some((v) => v.trim())) return null;
  return contactSchema.safeParse({ ...input, is_primary: true });
}

export async function createClientRecord(_prev: FormState, formData: FormData): Promise<FormState> {
  const client = parseClient(formData);
  const contact = parseNewContact(formData);
  if (!client.success || contact?.success === false) {
    const contactErrors = contact?.error ? Object.entries(fieldErrors(contact.error)).map(([k, m]) => [`contact_${k}`, m]) : [];
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: { ...(client.error && fieldErrors(client.error)), ...Object.fromEntries(contactErrors) },
    };
  }

  const supabase = await createClient();
  const { data: organizationId } = await supabase.rpc("current_org_id");
  if (!organizationId) return { error: NO_PERMISSION };

  const { data, error } = await supabase
    .from("clients")
    .insert({ ...client.data, organization_id: organizationId })
    .select("id")
    .single();
  if (error) return { error: NO_PERMISSION };

  if (contact?.success) {
    const { error: contactError } = await supabase
      .from("client_contacts")
      .insert({ ...contact.data, client_id: data.id, organization_id: organizationId });
    // The client exists now; send the user to it to add the contact there rather than resubmitting a duplicate.
    if (contactError) redirect(`/clients/${data.id}?contact=failed`);
  }

  revalidatePath("/clients");
  redirect(`/clients/${data.id}`);
}

export async function updateClientRecord(clientId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!id.safeParse(clientId).success) return { error: "Invalid request." };
  const client = parseClient(formData);
  if (!client.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(client.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").update(client.data).eq("id", clientId).select("id");
  if (error || !data.length) return { error: NO_PERMISSION };

  revalidatePath("/clients");
  redirect(`/clients/${clientId}`);
}

export async function setClientArchived(clientId: string, archived: boolean) {
  if (!id.safeParse(clientId).success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .update({ deleted_at: archived ? new Date().toISOString() : null })
    .eq("id", clientId)
    .select("id");
  if (error || !data.length) return { error: NO_PERMISSION };

  revalidatePath("/clients");
  return { ok: true };
}

/** Adds a contact, or updates it when `contactId` is given. Keeps a single primary contact per client. */
export async function saveContact(
  clientId: string,
  contactId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!id.safeParse(clientId).success || (contactId && !id.safeParse(contactId).success)) return { error: "Invalid request." };
  const contact = parseContact(formData);
  if (!contact.success) return { fieldErrors: fieldErrors(contact.error) };

  const supabase = await createClient();
  const { data: organizationId } = await supabase.rpc("current_org_id");
  if (!organizationId) return { error: NO_PERMISSION };

  // Marking a contact primary un-marks the others in the database (trigger one_primary_contact).
  const { error } = contactId
    ? await supabase.from("client_contacts").update(contact.data).eq("id", contactId).eq("client_id", clientId)
    : await supabase.from("client_contacts").insert({ ...contact.data, client_id: clientId, organization_id: organizationId });
  if (error) return { error: NO_PERMISSION };

  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

export async function deleteContact(clientId: string, contactId: string) {
  if (!id.safeParse(clientId).success || !id.safeParse(contactId).success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_contacts")
    .delete()
    .eq("id", contactId)
    .eq("client_id", clientId)
    .select("id");
  if (error || !data.length) return { error: NO_PERMISSION };

  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}
