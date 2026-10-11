"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignInState = { error?: string; email?: string };

const INACTIVE_MESSAGE = "Your account is inactive. Ask your administrator to reactivate it.";

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  // One message for every failure, so the form doesn't reveal which emails exist.
  if (error) return { error: "Invalid email or password.", email };

  // Deactivated users (PRD §6) keep their login but lose access; say so instead of opening an empty app.
  const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).single();
  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return { error: INACTIVE_MESSAGE, email };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type PasswordState = { error?: string };

/** After an invite or password link (PRD §6): the link already signed the user in; now they choose a password. */
export async function setPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== String(formData.get("confirm") ?? "")) return { error: "The passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.code === "same_password" ? "Choose a password you haven't used before." : error.message };
  redirect("/");
}

export type ResetState = { sent?: boolean; error?: string };

/**
 * "Forgot password?" (PRD §6): Supabase emails a one-time link through Resend; it opens /auth/confirm → /set-password.
 * Always reports success so the form doesn't reveal which emails have accounts.
 */
export async function requestPasswordReset(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter your email." };
  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/confirm` });
  if (error?.status === 429) return { error: "Too many requests. Try again in a few minutes." };
  return { sent: true };
}
