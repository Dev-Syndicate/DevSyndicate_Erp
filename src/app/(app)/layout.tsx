import { Suspense } from "react";
import { SidebarSkeleton } from "@/components/page-skeletons";
import { AppBreadcrumb } from "@/components/layout/app-breadcrumb";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getCurrentUser } from "@/features/auth/queries";
import { BackupStatus } from "@/features/settings/components/backup-status";

async function UserSidebar() {
  return <AppSidebar user={await getCurrentUser()} />;
}

// shortcut: sidebar always starts open; read the "sidebar_state" cookie (inside <Suspense>) if users want it remembered.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      {/* Fallback reserves the sidebar's space. It must not read the URL (dynamic routes prerender it)
          or use sidebar context (unavailable when the fallback is prerendered). */}
      <Suspense fallback={<SidebarSkeleton />}>
        <UserSidebar />
      </Suspense>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 self-center data-[orientation=vertical]:h-4" />
          {/* Reads the URL, so it must sit inside Suspense for dynamic routes. */}
          <Suspense>
            <AppBreadcrumb />
          </Suspense>
          <div className="ml-auto flex items-center gap-2">
            <Suspense>
              <BackupStatus />
            </Suspense>
            <ThemeToggle />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
