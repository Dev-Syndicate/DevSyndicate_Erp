import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerTools } from "@/features/mcp/tools";
import { createBearerClient } from "@/lib/supabase/bearer";

// Claude connector (PRD §48): tools run as the signed-in user via their Supabase OAuth token.
const handler = createMcpHandler(registerTools, {
  serverInfo: { name: "devsyndicate-erp", version: "1.0.0" },
  instructions:
    "DevSyndicate ERP (Indian agency, amounts in INR). Leads: find, add, update, log calls, mark won. Quotations: find clients, create and edit drafts. Dates are YYYY-MM-DD (IST).",
});

/** Accepts any valid Supabase access token for this project; the database decides what the user may do. */
async function verifyToken(_req: Request, token?: string): Promise<AuthInfo | undefined> {
  if (!token) return undefined;
  const { data, error } = await createBearerClient(token).auth.getClaims(token);
  if (error || !data?.claims.sub) return undefined;
  return {
    token,
    clientId: String(data.claims.client_id ?? "erp"),
    scopes: [],
    expiresAt: data.claims.exp,
    extra: { userId: data.claims.sub },
  };
}

const authHandler = withMcpAuth(handler, verifyToken, { required: true });

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
