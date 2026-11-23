import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ListPagination, parseListParams } from "@/components/list-controls";
import { ListSkeleton } from "@/components/page-skeletons";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/features/auth/queries";
import { PostFilters } from "@/features/blog/components/post-filters";
import { PostsTable } from "@/features/blog/components/posts-table";
import { listCategories, listPosts } from "@/features/blog/queries";
import { POST_STATUSES } from "@/features/blog/schema";

async function Posts({ searchParams }: { searchParams: PageProps<"/blog/posts">["searchParams"] }) {
  const raw = await searchParams;
  const params = parseListParams(raw);
  const categories = await listCategories();
  // Anything not on these lists (including the form's "all") means no filter.
  const category = categories.find((c) => c.id === raw.category)?.id ?? "";
  const status = POST_STATUSES.find((s) => s.value === raw.status)?.value ?? "";
  const [{ rows, total }, user] = await Promise.all([listPosts({ ...params, category, status }), getCurrentUser()]);

  return (
    <>
      {user?.permissions.includes("blog.create") && (
        <Button asChild className="self-end">
          <Link href="/blog/posts/new">
            <Plus /> New post
          </Link>
        </Button>
      )}
      <PostFilters f={{ q: params.q, category, status }} categories={categories} />
      <PostsTable rows={rows} />
      <ListPagination path="/blog/posts" {...params} total={total} params={{ category, status }} />
    </>
  );
}

export default function PostsPage({ searchParams }: PageProps<"/blog/posts">) {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Blog posts</h1>
      <Suspense fallback={<ListSkeleton />}>
        <Posts searchParams={searchParams} />
      </Suspense>
    </>
  );
}
