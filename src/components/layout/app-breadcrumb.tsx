"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { navigation, navRoutes } from "@/config/navigation";

const ACTION_LABELS: Record<string, string> = { new: "New", edit: "Edit" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Nav groups without their own page (e.g. /settings) render as plain text, not links.
const groupOnly = new Set(
  navigation.filter((g) => g.children && !g.children.some((c) => c.href === g.href)).map((g) => g.href),
);

function crumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((segment, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const nav = navRoutes.find((r) => r.href === href);
    // shortcut: record ids show as "Details"; show the record name once pages pass it in.
    const label = nav?.title ?? ACTION_LABELS[segment] ?? (UUID_RE.test(segment) ? "Details" : segment);
    return { href, label, linkable: !groupOnly.has(href) };
  });
}

export function AppBreadcrumb() {
  const items = crumbs(usePathname());

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {items.length ? (
            <BreadcrumbLink asChild>
              <Link href="/">Home</Link>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>Home</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {items.map((item, i) => (
          <Fragment key={item.href}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {i === items.length - 1 ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : item.linkable ? (
                <BreadcrumbLink asChild>
                  <Link href={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              ) : (
                <span>{item.label}</span>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
