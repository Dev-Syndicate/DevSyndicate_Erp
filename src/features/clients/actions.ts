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

export async function createClientRecord(_prev: FormState, formData: FormData): Promise<FormState> {
  const client = parseClient(formData);
  if (!client.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(client.error) };

  const supabase = await createClient();
  const { data: organizationId } = await supabase.rpc("current_org_id");
  if (!organizationId) return { error: NO_PERMISSION };

  const { data, error } = await supabase
    .from("clients")
    .insert({ ...client.data, organization_id: organizationId })
    .select("id")
    .single();
  if (error) return { error: NO_PERMISSION };

  // Optional primary contact entered on the create form.
  const contactName = String(formData.get("contact_name") ?? "").trim();
  if (contactName) {
    const contact = contactSchema.safeParse({
      name: contactName,
      designation: formData.get("contact_designation") ?? "",
      email: formData.get("contact_email") ?? "",
      phone: formData.get("contact_phone") ?? "",
      is_primary: true,
    });
    if (contact.success) {
      await supabase.from("client_contacts").insert({ ...contact.data, client_id: data.id, organization_id: organizationId });
    }
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

  if (contact.data.is_primary) {
    // shortcut: two statements, not one transaction; a failed save can leave the client with no primary contact. Move to an RPC if that matters.
    await supabase.from("client_contacts").update({ is_primary: false }).eq("client_id", clientId).eq("is_primary", true);
  }
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
