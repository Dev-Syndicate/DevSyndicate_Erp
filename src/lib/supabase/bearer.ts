import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Client acting as the user whose access token is given (e.g. an OAuth token Claude holds, PRD §48), so RLS applies
 * exactly as in the app. No cookies and no service role.
 */
export function createBearerClient(token: string) {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type BearerClient = ReturnType<typeof createBearerClient>;
