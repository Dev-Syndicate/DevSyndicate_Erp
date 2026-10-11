"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ChevronsUpDown, LogOut } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { brand, navigation, type NavItem } from "@/config/navigation";
import { signOut } from "@/features/auth/actions";
import type { CurrentUser } from "@/features/auth/queries";

// UI-only filtering; RLS enforces the real access rules.
function visibleNav(permissions: string[]): NavItem[] {
  const can = (item: NavItem) => permissions.includes(item.permission);
  return navigation.flatMap((item) => {
    if (!item.children) return can(item) ? [item] : [];
    const children = item.children.filter(can);
    return children.length ? [{ ...item, children }] : [];
  });
}

export function AppSidebar({ user }: { user: CurrentUser | null }) {
  const pathname = usePathname();
  const items = visibleNav(user?.permissions ?? []);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <brand.icon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{brand.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{brand.product}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className="gap-1">
            {items.map((item) =>
              item.children ? (
                <Collapsible
                  key={item.href}
                  asChild
                  defaultOpen={pathname.startsWith(item.href)}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={item.title}>
                        {item.icon && <item.icon />}
                        <span>{item.title}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.children.map((child) => (
                          <SidebarMenuSubItem key={child.href}>
                            <SidebarMenuSubButton asChild isActive={isActive(child.href)}>
                              <Link href={child.href}>{child.title}</Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ) : (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild tooltip={item.title} isActive={isActive(item.href)}>
                    <Link href={item.href}>
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ),
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {user && (
        <SidebarFooter>
          {!user.isActive && (
            <p className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              Your account has no access yet. Ask an administrator.
            </p>
          )}
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent text-sm font-medium uppercase">
                      {(user.fullName || user.email).charAt(0)}
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{user.fullName || user.email}</span>
                      {user.fullName && <span className="truncate text-xs text-muted-foreground">{user.email}</span>}
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width)">
                  <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => signOut()}>
                    <LogOut />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  );
}
