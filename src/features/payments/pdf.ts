import { pdfCompany, pdfDate, renderReceiptPdf } from "@/components/pdf/document-pdf";
import { getPayment } from "@/features/payments/queries";
import { methodLabel } from "@/features/payments/schema";
import { getCompanySettings } from "@/features/settings/queries";
import { gstInside, paise } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

// shortcut: advances are taxed at 18%, the Rule 50 default when the rate isn't known yet. Use the quotation's
// rate once receipts can be linked to a quotation.
const ADVANCE_GST_RATE = 1800n;

/**
 * Receipt PDF for a confirmed payment (RLS applies: null when the user can't see it).
 * GST-registered: an advance prints as a Receipt Voucher (CGST Rule 50) and a refund as a Refund Voucher (Rule 51).
 */
export async function paymentPdf(id: string) {
  const [p, settings, supabase] = await Promise.all([getPayment(id).catch(() => null), getCompanySettings(), createClient()]);
  if (!p || !settings || p.status !== "confirmed" || !p.number) return null;
  const c = p.clients;
  const receipt = p.kind === "receipt";
  const amount = paise(p.amount);
  const tds = paise(p.tds_amount);
  const advance = receipt ? paise(p.unallocated ?? 0) : 0n;
  const taxedBase = receipt ? advance : amount;
  const voucher = settings.gst_registered && c?.country === "India" && taxedBase > 0n;

  let gst;
  if (voucher) {
    const { taxable, tax } = gstInside(taxedBase, ADVANCE_GST_RATE);
    // Unknown place of supply is treated as inter-state (Rule 50).
    const intra = !!c?.state && c.state === settings.state;
    const half = (tax + 1n) / 2n;
    gst = {
      rate: Number(ADVANCE_GST_RATE) / 100,
      taxable,
      lines: (intra ? [["CGST", half], ["SGST", tax - half]] : [["IGST", tax]]) as [string, bigint][],
      placeOfSupply: c?.state || "Not known (inter-state)",
    };
  }

  const pdf = await renderReceiptPdf({
    title: receipt ? (voucher ? "Receipt Voucher" : "Payment Receipt") : voucher ? "Refund Voucher" : "Refund Receipt",
    number: p.number,
    date: pdfDate(p.payment_date),
    ...(await pdfCompany(supabase, settings)),
    party: {
      label: receipt ? "Received from" : "Refunded to",
      name: c?.company_name ?? "",
      lines: [c?.billing_address ?? "", c?.city ?? "", c?.state ?? "", c?.pin_code ?? ""],
      gstin: c?.gstin ?? "",
    },
    rows: receipt
      ? [["Amount received", amount], ...(tds > 0n ? ([["TDS deducted by client", tds]] as [string, bigint][]) : [])]
      : [],
    total: receipt ? ["Total settled", amount + tds] : ["Amount refunded", amount],
    details: [["Payment method", methodLabel(p.method)], ...(p.reference ? ([["Reference", p.reference]] as [string, string][]) : [])],
    applied: p.payment_allocations.map((a) => ({
      invoice: a.invoices?.number ?? "",
      date: a.invoices ? pdfDate(a.invoices.invoice_date) : "",
      amount: paise(a.amount),
    })),
    advance,
    gst,
    notes: p.notes,
  });
  return { pdf, filename: `${receipt ? "Receipt" : "Refund"}-${p.number}` };
}
