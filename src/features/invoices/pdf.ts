import { pdfCompany, renderDocumentPdf } from "@/components/pdf/document-pdf";
import { getInvoice } from "@/features/invoices/queries";
import { getCompanySettings } from "@/features/settings/queries";
import { formatDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

/** Renders an invoice PDF (RLS applies: null when the user can't see it). Issued invoices use the billing snapshot. */
export async function invoicePdf(id: string) {
  const [inv, settings, supabase] = await Promise.all([getInvoice(id).catch(() => null), getCompanySettings(), createClient()]);
  if (!inv || !settings) return null;
  const c = inv.clients;
  const issued = inv.status !== "draft";
  const number = inv.number ?? "DRAFT";
  const title = inv.gst_applicable ? "Tax Invoice" : "Invoice";
  const bank = [
    settings.bank_name && `Bank: ${settings.bank_name}`,
    settings.bank_account_name && `Account name: ${settings.bank_account_name}`,
    settings.bank_account_number && `Account number: ${settings.bank_account_number}`,
    settings.bank_ifsc && `IFSC: ${settings.bank_ifsc}`,
    settings.upi_id && `UPI: ${settings.upi_id}`,
  ]
    .filter(Boolean)
    .join("\n");

  const pdf = await renderDocumentPdf({
    title: inv.status === "cancelled" ? `${title} (Cancelled)` : title,
    number,
    meta: [
      ["Invoice date", formatDate(inv.invoice_date)],
      ["Due date", formatDate(inv.due_date)],
      ["Place of supply", inv.supply_type === "export" ? "Outside India" : inv.place_of_supply || "—"],
      ...(inv.quotations?.number ? ([["Quotation", inv.quotations.number]] as [string, string][]) : []),
      ...(inv.lut_number ? ([["LUT", inv.lut_number]] as [string, string][]) : []),
    ],
    ...(await pdfCompany(supabase, settings)),
    billTo: {
      name: issued ? inv.billing_name : (c?.company_name ?? ""),
      address: issued ? inv.billing_address : [c?.billing_address, c?.city, c?.state, c?.pin_code, c?.country].filter(Boolean).join(", "),
      gstin: issued ? inv.billing_gstin : (c?.gstin ?? ""),
      attention: inv.client_contacts?.name,
    },
    supplyType: inv.supply_type,
    gst: inv.gst_applicable,
    showSac: settings.show_sac,
    items: inv.invoice_items,
    totals: inv,
    sections: [
      { label: "Bank details", text: bank },
      { label: "Terms", text: inv.terms },
      { label: "Notes", text: inv.notes },
    ],
  });
  return { pdf, filename: `Invoice-${number}` };
}
