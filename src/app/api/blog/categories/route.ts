import { connection } from "next/server";
import { publicCategories } from "@/features/blog/queries";

// Public website API (PRD §49): every category. CDN caches for 5 minutes.
export async function GET() {
  // Read at request time, not frozen into the build.
  await connection();
  return Response.json(await publicCategories(), { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
