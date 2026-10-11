"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatINR } from "@/lib/money";

const config = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
  expenses: { label: "Expenses", color: "var(--chart-2)" },
} satisfies ChartConfig;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Revenue vs expenses per month of the financial year (PRD §36). */
export function RevenueChart({ monthly, fy }: { monthly: { month: string; revenue: string; expenses: string }[]; fy: string }) {
  // Numbers only for drawing bars; the labels use the exact text amounts.
  const data = monthly.map((m) => ({
    month: MONTHS[Number(m.month.slice(5)) - 1],
    revenue: Number(m.revenue),
    expenses: Number(m.expenses),
    exact: m,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue vs expenses</CardTitle>
        <CardDescription>Per month, FY {fy}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-72 w-full">
          <BarChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => (v >= 100000 ? `${v / 100000}L` : v >= 1000 ? `${v / 1000}k` : String(v))} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(_value, name, item) => (
                    <div className="flex w-full justify-between gap-4">
                      <span className="text-muted-foreground">{config[name as keyof typeof config].label}</span>
                      <span className="font-medium tabular-nums">{formatINR(item.payload.exact[name as "revenue" | "expenses"])}</span>
                    </div>
                  )}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
            <Bar dataKey="expenses" fill="var(--color-expenses)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
