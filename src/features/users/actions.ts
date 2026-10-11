"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import type { FormState } from "@/lib/forms";
import { dbErrorMessage } from "@/lib/line-items";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const id = z.uuid();
const inviteSchema = z.object({
  full_name: z.string().trim().min(1, "Enter their name").max(100),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  role_id: z.uuid("Choose a role"),
});

type LinkState = FormState & { link?: string };

/** Our own confirm route, so the link works without Supabase's email (PRD §6). */
async function confirmLink(tokenHash: string, type: "invite" | "recovery") {
  const origin = (await headers()).get("origin") ?? "";
  return `${origin}/auth/confirm?${new URLSearchParams({ token_hash: tokenHash, type })}`;
}

/**
 * Invites a user: the database checks the inviter's rights first (check_invite), the service role only creates the
 * account and its one-time link, then the role is given with the inviter's session (activate_invited_user).
 */
export async function inviteUser(input: z.input<typeof inviteSchema>): Promise<LinkState> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { full_name, email, role_id } = parsed.data;

  const supabase = await createClient();
  const check = await supabase.rpc("check_invite", { p_email: email, p_role_id: role_id });
  if (check.error) return { error: dbErrorMessage(check.error) };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "invite", email, options: { data: { full_name } } });
  if (error || !data.user) return { error: "Could not create the invite. Please try again." };

  const activated = await supabase.rpc("activate_invited_user", { p_id: data.user.id, p_role_id: role_id, p_full_name: full_name });
  if (activated.error) {
    await admin.auth.admin.deleteUser(data.user.id); // don't leave a half-made account behind
    return { error: dbErrorMessage(activated.error) };
  }
  revalidatePath("/settings/users");
  return { ok: true, link: await confirmLink(data.properties.hashed_token, "invite") };
}

/** A fresh one-time link to set a password: for invitees whose link expired, or users who forgot their password. */
export async function userLink(userId: string): Promise<LinkState> {
  if (!id.safeParse(userId).success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data: email, error } = await supabase.rpc("check_user_link", { p_id: userId });
  if (error || !email) return { error: error ? dbErrorMessage(error) : "User not found." };

  const { data, error: linkError } = await createAdminClient().auth.admin.generateLink({ type: "recovery", email });
  if (linkError) return { error: "Could not create the link. Please try again." };
  return { ok: true, link: await confirmLink(data.properties.hashed_token, "recovery") };
}

export async function updateUser(userId: string, roleId: string, isActive: boolean): Promise<FormState> {
  if (!id.safeParse(userId).success || !id.safeParse(roleId).success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_user", { p_id: userId, p_role_id: roleId, p_is_active: isActive });
  // The profile guard trigger raises plain exceptions (Super Admin rules, no changes to yourself).
  if (error) return { error: error.code === "P0001" ? `${error.message.charAt(0).toUpperCase()}${error.message.slice(1)}.` : dbErrorMessage(error) };
  revalidatePath("/settings/users");
  return { ok: true };
}
