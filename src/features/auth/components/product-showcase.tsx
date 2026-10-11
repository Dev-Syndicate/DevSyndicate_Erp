import Image from "next/image";
import {
  BarChart3,
  Bell,
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
import { Badge } from "@/components/ui/badge";
import { brand } from "@/config/navigation";
import { cn } from "@/lib/utils";

// Decorative mock of the app window for the sign-in page: sample data only, theme tokens only.
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
  { client: "Globex", detail: "₹2,36,000 · 18d overdue", dot: "bg-destructive" },
  { client: "Northwind", detail: "₹64,900 · due in 5d", dot: "bg-info" },
  { client: "Initech", detail: "₹42,480 · part paid", dot: "bg-warning" },
  { client: "Stark Labs", detail: "₹1,05,020 · 32d overdue", dot: "bg-destructive" },
  { client: "Umbrella", detail: "₹88,500 · due in 12d", dot: "bg-info" },
  { client: "Wayne & Co", detail: "Paid today", dot: "bg-success" },
];

export function ProductShowcase() {
  return (
    <div aria-hidden className="relative hidden items-center justify-center overflow-hidden border-l bg-muted p-10 select-none lg:flex">
      <div className="absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[18px_18px]" />

      <div className="relative w-full max-w-2xl overflow-hidden rounded-xl border bg-background text-xs shadow-2xl">
        <div className="flex h-11 items-center gap-3 border-b px-3">
          <Image src={brand.logo} alt="" width={24} height={24} className="size-6 rounded-md" />
          <span className="font-semibold">{brand.name}</span>
          <div className="ml-3 flex flex-1 items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-muted-foreground">
            <Search className="size-3.5" />
            Search invoices, clients…
          </div>
          <Bell className="size-4 text-muted-foreground" />
          <Settings className="size-4 text-muted-foreground" />
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">A</span>
        </div>

        <div className="grid h-80 grid-cols-[8.5rem_1fr_11.5rem]">
          <div className="space-y-0.5 border-r p-2">
            {NAV.map((n) => (
              <div key={n.title} className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground", n.active && "bg-accent font-medium text-accent-foreground")}>
                <n.icon className="size-3.5" />
                {n.title}
              </div>
            ))}
          </div>

          <div className="relative flex flex-col items-center justify-center gap-2 bg-linear-to-b from-success/10 to-transparent">
            <span className="absolute top-2.5 left-3 flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
              <ShieldCheck className="size-3" />
              GST ready · Audit logged
            </span>

            <div className="rounded-full bg-success/10 p-2.5">
              <div className="rounded-full bg-success/15 p-2.5">
                <div className="flex size-14 items-center justify-center rounded-full border bg-background text-success">
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
              {OUTSTANDING.map((o) => (
                <div key={o.client} className="flex items-center gap-2">
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
    </div>
  );
}
