import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { FormSkeleton } from "@/components/page-skeletons";
import { getCurrentUser } from "@/features/auth/queries";
import { deletePost, setPostStatus } from "@/features/blog/actions";
import { CoverCard } from "@/features/blog/components/cover-card";
import { PostForm } from "@/features/blog/components/post-form";
import { PostStatusBadge } from "@/features/blog/components/posts-table";
import { getPost, listCategories } from "@/features/blog/queries";

async function EditPost({ params }: { params: PageProps<"/blog/posts/[id]">["params"] }) {
  const { id } = await params;
  const [post, categories, user] = await Promise.all([getPost(id).catch(() => null), listCategories(), getCurrentUser()]);
  if (!post) notFound();
  const can = (p: string) => !!user?.permissions.includes(p);
  const published = post.status === "published";
  // RLS: drafts need blog.update; published posts need blog.publish (PRD §49).
  const canEdit = published ? can("blog.publish") : can("blog.update");

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{post.title}</h1>
        <PostStatusBadge status={post.status} />
        <div className="ml-auto flex gap-2">
          {can("blog.delete") && (
            <ConfirmButton
              action={deletePost.bind(null, post.id)}
              title="Delete post?"
              description={published ? "It disappears from the website at once. This can't be undone." : "This can't be undone."}
              confirmLabel="Delete"
              successMessage="Post deleted"
              variant="ghost"
            >
              Delete
            </ConfirmButton>
          )}
          {can("blog.publish") && (
            <ConfirmButton
              action={setPostStatus.bind(null, post.id, published ? "draft" : "published")}
              title={published ? "Unpublish post?" : "Publish post?"}
              description={
                published
                  ? "It is removed from the website and becomes a draft again."
                  : `It appears on the website${post.cover_url ? "" : " without a cover image"}. Check the content, excerpt and SEO fields first.`
              }
              confirmLabel={published ? "Unpublish" : "Publish"}
              successMessage={published ? "Post unpublished" : "Post published"}
              variant={published ? "outline" : "default"}
            >
              {published ? "Unpublish" : "Publish"}
            </ConfirmButton>
          )}
        </div>
      </div>
      {published && !canEdit && <p className="text-sm text-muted-foreground">This post is live. Only someone who can publish can change it.</p>}
      <CoverCard postId={post.id} url={post.cover_url} alt={post.cover_image_alt} canEdit={canEdit} />
      <PostForm post={post} categories={categories} readOnly={!canEdit} />
    </>
  );
}

export default function EditPostPage({ params }: PageProps<"/blog/posts/[id]">) {
  return (
    <Suspense fallback={<FormSkeleton title />}>
      <EditPost params={params} />
    </Suspense>
  );
}
