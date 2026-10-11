import { buildReport } from "@/features/reports/queries";
import { parseReportParams, tableCsv } from "@/features/reports/utils";
import { istToday } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

/** CSV of the report on screen (PRD §27); needs reports.export. RLS still decides which rows are included. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("has_permission", { p: "reports.export" });
  if (!allowed) return new Response("Forbidden", { status: 403 });

  const params = parseReportParams(Object.fromEntries(new URL(request.url).searchParams));
  const report = await buildReport(params.name, params);
  const filename = params.name === "outstanding" ? `outstanding-${istToday()}` : `${params.name}-${params.from}-to-${params.to}`;
  return new Response(tableCsv(report.csv), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
