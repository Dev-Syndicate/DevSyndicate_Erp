import { Suspense } from "react";
import { ListSkeleton } from "@/components/page-skeletons";
import { getCurrentUser } from "@/features/auth/queries";
import { CategoriesCard } from "@/features/blog/components/categories-card";
import { listCategories } from "@/features/blog/queries";

async function Categories() {
  const [rows, user] = await Promise.all([listCategories(), getCurrentUser()]);
  return <CategoriesCard rows={rows} canEdit={!!user?.permissions.includes("blog.update")} />;
}

export default function BlogCategoriesPage() {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Blog categories</h1>
      <Suspense fallback={<ListSkeleton />}>
        <Categories />
      </Suspense>
    </>
  );
}
