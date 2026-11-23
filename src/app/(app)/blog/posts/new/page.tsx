import { Suspense } from "react";
import { FormSkeleton } from "@/components/page-skeletons";
import { PostForm } from "@/features/blog/components/post-form";
import { listCategories } from "@/features/blog/queries";

async function NewPost() {
  return <PostForm categories={await listCategories()} />;
}

export default function NewPostPage() {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">New post</h1>
      <p className="text-sm text-muted-foreground">Saved as a draft. Add the cover image after creating it, then publish.</p>
      <Suspense fallback={<FormSkeleton />}>
        <NewPost />
      </Suspense>
    </>
  );
}
