"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, CheckCheck, Globe, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { StatusTile } from "@/components/status-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { markAllNotificationsRead, markNotificationRead } from "@/features/notifications/actions";
import { cn } from "@/lib/utils";

type Notification = { id: string; kind: string; title: string; body: string; link: string; read_at: string | null; created_at: string };

// One icon per kind; add a line when a module starts sending a new kind (PRD §50).
const ICONS: Record<string, LucideIcon> = { website_enquiry: Globe };

// Newest unread notification the bell already opened for, so it opens once per new one, not on every page load.
const SEEN_KEY = "notifications:auto-opened";

const when = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Top-bar bell: the user's own notifications, unread highlighted. Updates on page load (no polling, PRD §50). */
export function NotificationsBell({ rows, unread }: { rows: Notification[]; unread: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const newestUnread = rows.find((n) => !n.read_at)?.id;

  useEffect(() => {
    if (!newestUnread || localStorage.getItem(SEEN_KEY) === newestUnread) return;
    localStorage.setItem(SEEN_KEY, newestUnread);
    setIsOpen(true); // eslint-disable-line react-hooks/set-state-in-effect -- localStorage only exists in the browser
  }, [newestUnread]);

  function open(n: Notification) {
    setIsOpen(false);
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
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label={unread ? `${unread} unread notifications` : "Notifications"}>
          <Bell />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-info px-1 text-[10px] text-info-foreground tabular-nums">
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 gap-0 overflow-hidden p-0">
        <div className="flex items-center gap-2 px-4 py-3">
          <p className="font-medium">Notifications</p>
          {unread > 0 && <Badge className="bg-info/15 text-info tabular-nums">{unread} new</Badge>}
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={markAll} disabled={pending}>
              <CheckCheck /> Mark all as read
            </Button>
          )}
        </div>
        <Separator />
        {rows.length === 0 ? (
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BellOff />
              </EmptyMedia>
              <EmptyTitle>You&apos;re all caught up</EmptyTitle>
              <EmptyDescription>New website enquiries and other updates show up here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="max-h-[28rem] divide-y overflow-y-auto">
            {rows.map((n) => {
              const unreadRow = !n.read_at;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    disabled={pending}
                    className={cn(
                      "flex w-full items-start gap-3 border-l-2 px-4 py-3 text-left transition-colors hover:bg-muted/60",
                      unreadRow ? "border-l-info bg-info/5" : "border-l-transparent",
                    )}
                  >
                    <StatusTile icon={ICONS[n.kind] ?? Bell} className={unreadRow ? "bg-info/15 text-info" : undefined} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={cn("line-clamp-2 text-sm", unreadRow ? "font-medium" : "text-muted-foreground")}>{n.title}</span>
                      {n.body && <span className="truncate text-xs text-muted-foreground">{n.body}</span>}
                      <span className="text-xs text-muted-foreground/80">{when.format(new Date(n.created_at))}</span>
                    </span>
                    {unreadRow && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-info" aria-label="Unread" />}
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
