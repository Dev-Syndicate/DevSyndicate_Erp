"use client";

import { usePathname, useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PERIODS } from "@/lib/periods";

export function PeriodSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Select value={value} onValueChange={(v) => router.push(v === "fy" ? pathname : `${pathname}?period=${v}`)}>
      <SelectTrigger aria-label="Period" className="w-52">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERIODS.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
