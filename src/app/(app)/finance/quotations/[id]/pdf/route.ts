import { pdfResponse } from "@/components/pdf/document-pdf";
import { quotationPdf } from "@/features/quotations/pdf";

export async function GET(_request: Request, ctx: RouteContext<"/finance/quotations/[id]/pdf">) {
  const { id } = await ctx.params;
  const result = await quotationPdf(id);
  if (!result) return new Response("Not found", { status: 404 });
  return pdfResponse(result.pdf, result.filename);
}
