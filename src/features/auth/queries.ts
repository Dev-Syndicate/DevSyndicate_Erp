import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  email: string;
  fullName: string;
  /** e.g. "Super Admin"; empty when the user has no role yet. */
  roleName: string;
  isActive: boolean;
  permissions: string[];
};

/** Signed-in user's profile and permissions; null when signed out. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return null;

  const [{ data: profile }, { data: permissions }] = await Promise.all([
    supabase.from("profiles").select("email, full_name, is_active, roles(name)").eq("id", userId).single(),
    supabase.rpc("my_permissions"),
  ]);

  return {
    email: profile?.email ?? String(claims.claims.email ?? ""),
    fullName: profile?.full_name ?? "",
    roleName: profile?.roles?.name ?? "",
    isActive: profile?.is_active ?? false,
    permissions: permissions ?? [],
  };
}
