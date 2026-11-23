import { publicPosts } from "@/features/blog/queries";
import { SLUG_RE } from "@/features/blog/utils";

// Public website API (PRD §49): published posts only, newest first, without content. CDN caches for 5 minutes.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const category = params.get("category") ?? "";
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  if (category && !SLUG_RE.test(category)) return Response.json({ error: "Invalid category" }, { status: 400 });
  return Response.json(await publicPosts({ category, page }), { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
