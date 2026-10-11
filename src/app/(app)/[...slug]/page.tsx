import { notFound } from "next/navigation";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { navRoutes } from "@/config/navigation";

export const instant = false;

export function generateStaticParams() {
  return navRoutes.filter((r) => r.href !== "/" && !r.children).map((r) => ({ slug: r.href.slice(1).split("/") }));
}

// shortcut: one placeholder for every nav route not built yet; delete as each feature gets its own page.
export default async function PlaceholderPage({ params }: PageProps<"/[...slug]">) {
  const href = "/" + (await params).slug.join("/");
  const route = navRoutes.find((r) => r.href === href);
  // Menu groups (Finance, Settings) are not pages.
  if (!route || route.children) notFound();

  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">{route.title}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>This module is part of the V1 build plan (PRD §44).</CardDescription>
        </CardHeader>
      </Card>
    </>
  );
}
