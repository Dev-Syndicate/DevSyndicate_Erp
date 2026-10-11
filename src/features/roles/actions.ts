"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/forms";
import { dbErrorMessage } from "@/lib/line-items";
import { createClient } from "@/lib/supabase/server";

const id = z.uuid();
const NO_PERMISSION = "You don't have permission to do this.";

/** Grant or revoke one permission (RLS: roles.manage; the Super Admin role is locked by a trigger). */
export async function setPermission(roleId: string, permission: string, granted: boolean): Promise<FormState> {
  if (!id.safeParse(roleId).success || !/^[a-z_]+\.[a-z_]+$/.test(permission)) return { error: "Invalid request." };
  const supabase = await createClient();
  const { error } = granted
    ? await supabase.from("role_permissions").insert({ role_id: roleId, permission })
    : await supabase.from("role_permissions").delete().eq("role_id", roleId).eq("permission", permission);
  if (error) return { error: error.code === "23505" ? "Already granted." : error.message.includes("Super Admin") ? error.message : NO_PERMISSION };
  revalidatePath("/settings/roles");
  return { ok: true };
}

export async function createRole(name: string): Promise<FormState & { id?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_role", { p_name: name });
  if (error) return { error: dbErrorMessage(error) };
  revalidatePath("/settings/roles");
  return { ok: true, id: data };
}

export async function deleteRole(roleId: string): Promise<FormState> {
  if (!id.safeParse(roleId).success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("roles").delete().eq("id", roleId).select("id");
  if (error?.code === "23503") return { error: "Some users still have this role. Give them another role first." };
  if (error) return { error: error.message.includes("system") ? "Built-in roles can't be deleted." : NO_PERMISSION };
  if (!data.length) return { error: NO_PERMISSION };
  revalidatePath("/settings/roles");
  return { ok: true };
}
