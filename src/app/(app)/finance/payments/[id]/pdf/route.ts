import { pdfResponse } from "@/components/pdf/document-pdf";
import { paymentPdf } from "@/features/payments/pdf";

export async function GET(_request: Request, ctx: RouteContext<"/finance/payments/[id]/pdf">) {
  const { id } = await ctx.params;
  const result = await paymentPdf(id);
  if (!result) return new Response("Not found", { status: 404 });
  return pdfResponse(result.pdf, result.filename);
}
