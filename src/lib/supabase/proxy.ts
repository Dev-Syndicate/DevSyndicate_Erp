import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

const PUBLIC_PATHS = ["/login", "/forgot-password"];
// Invite / password links: open whether or not someone is signed in (the link signs its owner in).
const LINK_PATHS = ["/auth/confirm"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Keep getClaims() directly after createServerClient: it refreshes the session cookies.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const isPublic = PUBLIC_PATHS.includes(request.nextUrl.pathname);
  if (LINK_PATHS.includes(request.nextUrl.pathname)) return response;

  // Come back to the page after signing in (e.g. the Claude connector's consent page, PRD §48).
  if (!signedIn && !isPublic) {
    const next = request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname + request.nextUrl.search;
    return redirectTo(request, response, "/login", next && `?${new URLSearchParams({ next })}`);
  }
  if (signedIn && isPublic) return redirectTo(request, response, "/");
  return response;
}

// Carry refreshed auth cookies over to the redirect response.
function redirectTo(request: NextRequest, from: NextResponse, pathname: string, search = "") {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
