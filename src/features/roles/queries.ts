import { createClient } from "@/lib/supabase/server";

/** Roles with their permissions, plus the full permission catalog (PRD §5). */
export async function getRolesWithPermissions() {
  const supabase = await createClient();
  const [roles, grants, catalog] = await Promise.all([
    supabase.from("roles").select("id, key, name, is_system").order("is_system", { ascending: false }).order("name"),
    supabase.from("role_permissions").select("role_id, permission"),
    supabase.from("permissions").select("key").order("key"),
  ]);
  for (const r of [roles, grants, catalog]) if (r.error) throw r.error;
  return {
    roles: (roles.data ?? []).map((r) => ({ ...r, permissions: (grants.data ?? []).filter((g) => g.role_id === r.id).map((g) => g.permission) })),
    permissions: (catalog.data ?? []).map((p) => p.key),
  };
}
