import { pdfResponse } from "@/components/pdf/document-pdf";
import { creditNotePdf } from "@/features/credit-notes/pdf";

export async function GET(_request: Request, ctx: RouteContext<"/finance/credit-notes/[id]/pdf">) {
  const { id } = await ctx.params;
  const result = await creditNotePdf(id);
  if (!result) return new Response("Not found", { status: 404 });
  return pdfResponse(result.pdf, result.filename);
}
