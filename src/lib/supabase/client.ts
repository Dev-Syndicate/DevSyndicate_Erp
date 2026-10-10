import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// Browser client with the signed-in user's session, so RLS applies. Used only for direct file uploads
// (server actions cap request bodies at 1 MB; PRD §20). Everything else goes through server code.
export function createClient() {
  return createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
