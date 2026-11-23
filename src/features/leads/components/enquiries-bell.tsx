"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";

type Enquiry = { id: string; name: string; company: string; created_at: string };

const when = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Top-bar bell: website enquiries still New, plus a pop-up the moment one arrives (Supabase Realtime, RLS applies). */
export function EnquiriesBell({ rows, total }: { rows: Enquiry[]; total: number }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("website-enquiries")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: "source=eq.website" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const lead = payload.new as Enquiry;
          toast.info(`New website enquiry from ${lead.name}`, {
            description: lead.company || undefined,
            action: { label: "Open", onClick: () => router.push(`/leads/${lead.id}`) },
            duration: 15000,
          });
        }
        // Someone worked or added a lead: refresh the count.
        router.refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label={total ? `${total} new website enquiries` : "Website enquiries"}>
          <Bell />
          {total > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-primary px-1 text-[10px] text-primary-foreground tabular-nums">{total > 9 ? "9+" : total}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3">
          <p className="text-sm font-medium">Website enquiries</p>
          <p className="text-xs text-muted-foreground">New until someone contacts them.</p>
        </div>
        <Separator />
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No new enquiries.</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/leads/${r.id}`} className="flex flex-col px-4 py-2 hover:bg-muted">
                  <span className="text-sm font-medium">{r.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {[r.company, when.format(new Date(r.created_at))].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Separator />
        <Link href="/leads?source=website&status=new" className="block px-4 py-2 text-center text-sm text-primary hover:bg-muted">
          See all{total > rows.length ? ` ${total}` : ""}
        </Link>
      </PopoverContent>
    </Popover>
  );
}
