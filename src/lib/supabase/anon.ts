import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/** No session: the `anon` role, for public endpoints (blog API, website form). RLS and grants decide what it reaches. */
export function createAnonClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
