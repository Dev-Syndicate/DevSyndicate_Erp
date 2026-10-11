import { createClient } from "@/lib/supabase/server";

/** Users the caller may see (list_users hides Super Admins from non-Super-Admins). */
export async function listUsers() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_users");
  if (error) throw error;
  return data;
}

/** Roles the caller can assign; only a Super Admin may give the Super Admin role. */
export async function getAssignableRoles(isSuperAdmin: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("roles").select("id, key, name").order("name");
  if (error) throw error;
  return data.filter((r) => isSuperAdmin || r.key !== "super_admin");
}
