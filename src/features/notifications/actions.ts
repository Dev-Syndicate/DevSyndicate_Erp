"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// RLS limits both to the signed-in user's own notifications (PRD §50).

export async function markNotificationRead(id: string) {
  if (!z.uuid().safeParse(id).success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  if (error) return { error: "Could not mark it read." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (error) return { error: "Could not mark them read." };
  revalidatePath("/", "layout");
  return { ok: true };
}
