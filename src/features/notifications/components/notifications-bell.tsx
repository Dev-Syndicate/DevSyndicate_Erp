"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Globe, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { markAllNotificationsRead, markNotificationRead } from "@/features/notifications/actions";
import { cn } from "@/lib/utils";

type Notification = { id: string; kind: string; title: string; body: string; link: string; read_at: string | null; created_at: string };

// One icon per kind; add a line when a module starts sending a new kind (PRD §50).
const ICONS: Record<string, LucideIcon> = { website_enquiry: Globe };

const when = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Top-bar bell: the user's own notifications, unread highlighted. Updates on page load (no polling, PRD §50). */
export function NotificationsBell({ rows, unread }: { rows: Notification[]; unread: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function open(n: Notification) {
    startTransition(async () => {
      if (!n.read_at) await markNotificationRead(n.id);
      if (n.link) router.push(n.link);
    });
  }

  function markAll() {
    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label={unread ? `${unread} unread notifications` : "Notifications"}>
          <Bell />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-primary px-1 text-[10px] text-primary-foreground tabular-nums">
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-medium">Notifications</p>
          {unread > 0 && (
            <Button variant="link" size="sm" className="h-auto p-0" onClick={markAll} disabled={pending}>
              Mark all as read
            </Button>
          )}
        </div>
        <Separator />
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {rows.map((n) => {
              const Icon = ICONS[n.kind] ?? Bell;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    disabled={pending}
                    className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-muted", !n.read_at && "bg-primary/5")}
                  >
                    <Icon className={cn("mt-0.5 size-4 shrink-0", n.read_at ? "text-muted-foreground" : "text-primary")} aria-hidden />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={cn("text-sm", !n.read_at && "font-medium")}>{n.title}</span>
                      {n.body && <span className="truncate text-xs text-muted-foreground">{n.body}</span>}
                      <span className="text-xs text-muted-foreground">{when.format(new Date(n.created_at))}</span>
                    </span>
                    {!n.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
