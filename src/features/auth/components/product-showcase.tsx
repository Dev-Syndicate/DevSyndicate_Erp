import Image from "next/image";
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  DatabaseBackup,
  Download,
  FileMinus,
  FileText,
  IndianRupee,
  LayoutDashboard,
  Mail,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { StatusTile } from "@/components/status-tile";
import { Badge } from "@/components/ui/badge";
import { brand } from "@/config/navigation";
import { cn } from "@/lib/utils";

// Decorative mock of the app for the sign-in page: sample data only, theme tokens only.
const NAV = [
  { title: "Dashboard", icon: LayoutDashboard },
  { title: "Quotations", icon: FileText },
  { title: "Invoices", icon: ReceiptText, active: true },
  { title: "Payments", icon: IndianRupee },
  { title: "Expenses", icon: Wallet },
  { title: "Reports", icon: BarChart3 },
];

const ACTIONS = [
  { label: "PDF", icon: Download },
  { label: "Send", icon: Mail },
  { label: "Credit note", icon: FileMinus },
  { label: "Payment", icon: IndianRupee, primary: true },
];

const OUTSTANDING = [
  { client: "Globex", detail: "₹2,36,000 · 18d overdue", dot: "bg-destructive motion-safe:animate-pulse" },
  { client: "Northwind", detail: "₹64,900 · due in 5d", dot: "bg-info" },
  { client: "Initech", detail: "₹42,480 · part paid", dot: "bg-warning" },
  { client: "Stark Labs", detail: "₹1,05,020 · 32d overdue", dot: "bg-destructive motion-safe:animate-pulse" },
  { client: "Umbrella", detail: "₹88,500 · due in 12d", dot: "bg-info" },
  { client: "Wayne & Co", detail: "Paid today", dot: "bg-success" },
];

const BARS = [40, 55, 48, 70, 62, 88];

/** Fades in after `delay` ms, then bobs up and down. */
function Floating({ className, delay, children }: { className: string; delay: number; children: React.ReactNode }) {
  return (
    <div className={cn("absolute z-10 duration-700 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-90 fill-mode-[both]", className)} style={{ animationDelay: `${delay}ms` }}>
      <div className="rounded-xl border bg-background/90 p-2.5 text-xs shadow-xl backdrop-blur motion-safe:animate-float" style={{ animationDelay: `${delay}ms` }}>
        {children}
      </div>
    </div>
  );
}

export function ProductShowcase() {
  return (
    <div aria-hidden className="relative hidden flex-col items-center justify-center gap-14 overflow-hidden border-l bg-muted px-14 py-12 select-none lg:flex">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--foreground),transparent_65%)] opacity-15" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,var(--foreground),transparent_55%)] opacity-5" />

      <div className="relative max-w-lg text-center duration-700 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          Built for Indian GST
        </span>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance">From quotation to payment, in one place.</h2>
        <p className="mt-2 text-sm text-balance text-muted-foreground">GST invoices, credit notes, TDS, expenses and reports for the whole team.</p>
      </div>

      <div className="relative w-full max-w-3xl">
        <div className="overflow-hidden rounded-xl border bg-background text-xs shadow-2xl duration-1000 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-8 fill-mode-[both]" style={{ animationDelay: "150ms" }}>
          <div className="flex h-11 items-center gap-3 border-b px-3">
            <Image src={brand.logo} alt="" width={24} height={24} className="size-6 rounded-md" />
            <span className="font-semibold">{brand.name}</span>
            <div className="ml-3 flex flex-1 items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-muted-foreground">
              <Search className="size-3.5" />
              Search invoices, clients…
            </div>
            <span className="relative">
              <Bell className="size-4 text-muted-foreground" />
              <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-destructive" />
              <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-destructive motion-safe:animate-ping" />
            </span>
            <Settings className="size-4 text-muted-foreground" />
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">A</span>
          </div>

          <div className="grid h-80 grid-cols-[8.5rem_1fr_12rem]">
            <div className="space-y-0.5 border-r p-2">
              {NAV.map((n) => (
                <div key={n.title} className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground", n.active && "bg-accent font-medium text-accent-foreground")}>
                  <n.icon className="size-3.5" />
                  {n.title}
                </div>
              ))}
            </div>

            <div className="relative flex flex-col items-center justify-center gap-2">
              <span className="absolute top-2.5 left-3 flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                <ShieldCheck className="size-3" />
                GST ready · Audit logged
              </span>

              <div className="relative rounded-full bg-foreground/5 p-2.5">
                <span className="absolute inset-0 rounded-full bg-foreground/5 motion-safe:animate-ping animation-duration-[2.5s]" />
                <div className="relative rounded-full bg-foreground/10 p-2.5">
                  <div className="flex size-14 items-center justify-center rounded-full border bg-background">
                    <ReceiptText className="size-6" />
                  </div>
                </div>
              </div>
              <p className="text-base font-semibold">Acme Labs</p>
              <p className="font-mono text-muted-foreground">INV-2026-0142</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tabular-nums">₹1,18,000</span>
                <Badge className="h-4 bg-success/15 px-1.5 text-[10px] text-success">Paid</Badge>
              </div>

              <div className="mt-2 flex gap-4">
                {ACTIONS.map((a) => (
                  <div key={a.label} className="flex flex-col items-center gap-1">
                    <span className={cn("flex size-9 items-center justify-center rounded-full border bg-background", a.primary && "border-transparent bg-primary text-primary-foreground")}>
                      <a.icon className="size-4" />
                    </span>
                    <span className="text-[10px] text-muted-foreground">{a.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-l p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-semibold">Outstanding</span>
                <Badge className="h-4 bg-destructive/15 px-1.5 text-[10px] text-destructive">2 overdue</Badge>
              </div>
              <div className="space-y-2.5">
                {OUTSTANDING.map((o, i) => (
                  <div
                    key={o.client}
                    className="flex items-center gap-2 duration-500 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 fill-mode-[both]"
                    style={{ animationDelay: `${600 + i * 100}ms` }}
                  >
                    <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-medium">
                      {o.client.charAt(0)}
                      <span className={cn("absolute right-0 bottom-0 size-2 rounded-full ring-2 ring-background", o.dot)} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{o.client}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{o.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Floating className="-top-10 -right-6" delay={900}>
          <div className="flex items-center gap-2.5 pr-2">
            <StatusTile icon={IndianRupee} className="bg-success/15 text-success" />
            <div>
              <p className="text-[10px] text-muted-foreground">Payment received · just now</p>
              <p className="font-semibold tabular-nums">₹1,18,000</p>
            </div>
          </div>
        </Floating>

        <Floating className="-bottom-12 -left-10" delay={1200}>
          <div className="w-40">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">Revenue · Oct</p>
              <span className="flex items-center text-[10px] font-medium text-success">
                <ArrowUpRight className="size-3" />
                12%
              </span>
            </div>
            <p className="font-semibold tabular-nums">₹4,82,000</p>
            <div className="mt-2 flex h-10 items-end gap-1">
              {BARS.map((h, i) => (
                <div key={i} className="flex-1 origin-bottom rounded-t-sm bg-foreground/80 motion-safe:animate-grow" style={{ height: `${h}%`, animationDelay: `${1400 + i * 100}ms` }} />
              ))}
            </div>
          </div>
        </Floating>

        <Floating className="right-8 -bottom-12" delay={1500}>
          <div className="flex items-center gap-2.5 pr-2">
            <StatusTile icon={DatabaseBackup} className="bg-info/15 text-info" />
            <div>
              <p className="text-[10px] text-muted-foreground">Backed up to Google Drive</p>
              <p className="font-medium">Today, 02:00 AM</p>
            </div>
          </div>
        </Floating>
      </div>
    </div>
  );
}
