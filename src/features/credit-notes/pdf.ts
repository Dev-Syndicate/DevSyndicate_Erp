import { pdfCompany, pdfDate, renderDocumentPdf } from "@/components/pdf/document-pdf";
import { getCreditNote } from "@/features/credit-notes/queries";
import { getCompanySettings } from "@/features/settings/queries";
import { createClient } from "@/lib/supabase/server";

/** Credit note PDF with the CGST Rule 53(1A) particulars (RLS applies: null when the user can't see it). */
export async function creditNotePdf(id: string) {
  const [cn, settings, supabase] = await Promise.all([getCreditNote(id).catch(() => null), getCompanySettings(), createClient()]);
  if (!cn || !settings) return null;
  const inv = cn.invoices;
  const issued = cn.status !== "draft";
  const number = cn.number ?? "DRAFT";

  const pdf = await renderDocumentPdf({
    title: cn.status === "cancelled" ? "Credit Note (Cancelled)" : "Credit Note",
    number: ["Credit Note No", number],
    meta: [
      ["Date", pdfDate(cn.credit_note_date)],
      ["Invoice No", inv?.number ?? ""],
      ["Invoice Date", inv ? pdfDate(inv.invoice_date) : ""],
      ["Place of Supply", cn.supply_type === "export" ? "Outside India" : cn.place_of_supply || "—"],
    ],
    ...(await pdfCompany(supabase, settings)),
    billTo: {
      name: (issued ? cn.billing_name : inv?.billing_name) || (cn.clients?.company_name ?? ""),
      lines: [(issued ? cn.billing_address : inv?.billing_address) ?? ""],
      gstin: (issued ? cn.billing_gstin : inv?.billing_gstin) ?? "",
    },
    supplyType: cn.supply_type,
    gst: cn.gst_applicable,
    showSac: settings.show_sac,
    items: cn.credit_note_items,
    totals: cn,
    amountInWords: true,
    sections: [
      { label: "Reason", text: cn.reason },
      { label: "Notes", text: cn.notes },
    ],
  });
  return { pdf, filename: `Credit-Note-${number}` };
}
