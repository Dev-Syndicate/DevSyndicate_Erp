import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * A user deactivated while signed in lands here from the app layout: sign out (a route handler can clear the session
 * cookies, a layout can't) and show the notice on the login page. Signs out only inactive users, so a link here
 * can't log anyone else out.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  const url = request.nextUrl.clone();
  url.search = "";
  url.pathname = "/";

  if (userId) {
    const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", userId).single();
    if (profile && !profile.is_active) {
      await supabase.auth.signOut();
      url.pathname = "/login";
      url.searchParams.set("account", "inactive");
    }
  }
  return NextResponse.redirect(url);
}
