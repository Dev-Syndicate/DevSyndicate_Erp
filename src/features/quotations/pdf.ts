import { pdfCompany, renderDocumentPdf } from "@/components/pdf/document-pdf";
import { quotationLabel } from "@/features/quotations/components/quotations-table";
import { getQuotation } from "@/features/quotations/queries";
import { getCompanySettings } from "@/features/settings/queries";
import { formatDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

/** Renders a quotation PDF (RLS applies: null when the user can't see it). Drafts print as DRAFT. */
export async function quotationPdf(id: string) {
  const [q, settings, supabase] = await Promise.all([getQuotation(id).catch(() => null), getCompanySettings(), createClient()]);
  if (!q || !settings) return null;
  const c = q.clients;
  const number = q.number ? quotationLabel(q) : "DRAFT";

  const pdf = await renderDocumentPdf({
    title: "Quotation",
    number,
    meta: [
      ["Date", formatDate(q.quotation_date)],
      ["Valid until", formatDate(q.valid_until)],
      ["Place of supply", q.supply_type === "export" ? "Outside India" : q.place_of_supply || "—"],
    ],
    heading: q.title,
    description: q.description,
    ...(await pdfCompany(supabase, settings)),
    billTo: {
      name: c?.company_name ?? "",
      address: [c?.billing_address, c?.city, c?.state, c?.pin_code, c?.country].filter(Boolean).join(", "),
      gstin: c?.gstin ?? "",
      attention: q.client_contacts?.name,
    },
    supplyType: q.supply_type,
    gst: q.gst_applicable,
    showSac: settings.show_sac,
    items: q.quotation_items,
    totals: q,
    sections: [
      { label: "Terms & conditions", text: q.terms },
      { label: "Notes", text: q.notes },
    ],
  });
  return { pdf, filename: `Quotation-${number}` };
}
