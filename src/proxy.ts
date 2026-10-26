import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // The MCP endpoint and its OAuth metadata use bearer tokens, not session cookies (PRD §48).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/mcp|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
