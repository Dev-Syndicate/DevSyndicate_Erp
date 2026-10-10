import { Suspense } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getCurrentUser } from "@/features/auth/queries";

async function UserSidebar() {
  return <AppSidebar user={await getCurrentUser()} />;
}

// shortcut: sidebar always starts open; read the "sidebar_state" cookie (inside <Suspense>) if users want it remembered.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <Suspense fallback={<AppSidebar user={null} />}>
        <UserSidebar />
      </Suspense>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
