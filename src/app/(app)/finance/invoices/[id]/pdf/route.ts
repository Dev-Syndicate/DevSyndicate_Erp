import { pdfResponse } from "@/components/pdf/document-pdf";
import { invoicePdf } from "@/features/invoices/pdf";

export async function GET(_request: Request, ctx: RouteContext<"/finance/invoices/[id]/pdf">) {
  const { id } = await ctx.params;
  const result = await invoicePdf(id);
  if (!result) return new Response("Not found", { status: 404 });
  return pdfResponse(result.pdf, result.filename);
}
