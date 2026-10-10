"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrors, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { vendorSchema } from "./schema";

const NO_PERMISSION = "You don't have permission to do this.";
const id = z.uuid();

/** Creates a vendor, or updates it when `vendorId` is given. */
export async function saveVendor(vendorId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  if (vendorId && !id.safeParse(vendorId).success) return { error: "Invalid request." };
  const vendor = vendorSchema.safeParse(Object.fromEntries(formData));
  if (!vendor.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(vendor.error) };

  const supabase = await createClient();
  if (vendorId) {
    const { data, error } = await supabase.from("vendors").update(vendor.data).eq("id", vendorId).select("id");
    if (error || !data.length) return { error: NO_PERMISSION };
  } else {
    const { data: organizationId } = await supabase.rpc("current_org_id");
    if (!organizationId) return { error: NO_PERMISSION };
    const { error } = await supabase.from("vendors").insert({ ...vendor.data, organization_id: organizationId });
    if (error) return { error: NO_PERMISSION };
  }

  revalidatePath("/vendors");
  redirect("/vendors");
}

export async function setVendorArchived(vendorId: string, archived: boolean) {
  if (!id.safeParse(vendorId).success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendors")
    .update({ deleted_at: archived ? new Date().toISOString() : null })
    .eq("id", vendorId)
    .select("id");
  if (error || !data.length) return { error: NO_PERMISSION };

  revalidatePath("/vendors");
  revalidatePath(`/vendors/${vendorId}/edit`);
  return { ok: true };
}
