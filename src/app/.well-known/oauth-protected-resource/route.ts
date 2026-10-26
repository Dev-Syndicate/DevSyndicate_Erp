import { getPublicOrigin, metadataCorsOptionsRequestHandler, protectedResourceHandler } from "mcp-handler";

// RFC 9728 metadata for /api/mcp: Claude learns to sign in with Supabase Auth's OAuth 2.1 server (PRD §48).
// The resource is the endpoint itself, not the site origin.
const handler = (req: Request) =>
  protectedResourceHandler({
    authServerUrls: [`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`],
    resourceUrl: `${getPublicOrigin(req)}/api/mcp`,
  })(req);
const corsHandler = metadataCorsOptionsRequestHandler();

export { handler as GET, corsHandler as OPTIONS };
