import { publicPost } from "@/features/blog/queries";
import { SLUG_RE } from "@/features/blog/utils";

const CACHE = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" };

// Public website API (PRD §49): one published post with content and SEO fields; drafts are 404.
export async function GET(_request: Request, ctx: RouteContext<"/api/blog/posts/[slug]">) {
  const { slug } = await ctx.params;
  const post = SLUG_RE.test(slug) ? await publicPost(slug) : null;
  if (!post) return Response.json({ error: "Not found" }, { status: 404, headers: CACHE });
  return Response.json(post, { headers: CACHE });
}
