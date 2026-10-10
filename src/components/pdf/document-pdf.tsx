// Quotation / invoice PDF (PRD §13, §15), rendered on the server with @react-pdf/renderer.
// PDFs have no theme: the greys below are print colours, not UI tokens (CLAUDE.md rule 2 covers the app UI).
// Noto Sans is embedded because the built-in PDF fonts have no ₹ glyph (PRD §33).

import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { amountInWords, formatINR, paise } from "@/lib/money";

const fonts = path.join(process.cwd(), "src/assets/fonts");
Font.register({
  family: "Noto Sans",
  fonts: [
    { src: path.join(fonts, "NotoSans-Regular.ttf") },
    { src: path.join(fonts, "NotoSans-Bold.ttf"), fontWeight: "bold" },
  ],
});
Font.registerHyphenationCallback((word) => [word]); // never split words across lines

const INK = "#111111";
const MUTED = "#666666";
const RULE = "#dddddd";
const SHADE = "#f4f4f4";

const s = StyleSheet.create({
  page: { fontFamily: "Noto Sans", fontSize: 9, color: INK, padding: 36, paddingBottom: 56, lineHeight: 1.4 },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  muted: { color: MUTED },
  bold: { fontWeight: "bold" },
  title: { fontSize: 18, fontWeight: "bold", textAlign: "right", lineHeight: 1.2, marginBottom: 2 },
  big: { fontSize: 11, lineHeight: 1.3 },
  logo: { maxHeight: 56, maxWidth: 160, marginBottom: 6, objectFit: "contain", objectPosition: "left" },
  box: { borderWidth: 1, borderColor: RULE, borderRadius: 4, padding: 10 },
  label: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", marginBottom: 3 },
  th: { backgroundColor: SHADE, fontWeight: "bold", paddingVertical: 5 },
  tr: { borderBottomWidth: 1, borderBottomColor: RULE, paddingVertical: 5 },
  cell: { paddingHorizontal: 4 },
  right: { textAlign: "right" },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 7.5, color: MUTED, flexDirection: "row", justifyContent: "space-between" },
});

export type PdfImage = { data: Buffer; format: "png" | "jpg" };

type Item = {
  position: number;
  description: string;
  sac_code: string;
  quantity: number;
  unit_price: number;
  discount_type: string;
  discount_value: number;
  tax_rate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  line_total: number;
};

export type PdfDoc = {
  /** "Quotation", "Tax Invoice" or "Invoice". */
  title: string;
  /** Number with revision, or "DRAFT". */
  number: string;
  /** Right-hand header rows, e.g. [["Date", "10-10-2026"], ["Valid until", "25-10-2026"]]. */
  meta: [string, string][];
  heading?: string;
  description?: string;
  company: { name: string; lines: string[]; logo: PdfImage | null };
  billTo: { name: string; address: string; gstin: string; attention?: string };
  supplyType: string;
  gst: boolean;
  showSac: boolean;
  items: Item[];
  totals: {
    subtotal: number;
    discount_total: number;
    taxable_total: number;
    cgst_total: number;
    sgst_total: number;
    igst_total: number;
    round_off: number;
    grand_total: number;
  };
  /** Extra blocks under the totals, e.g. bank details on invoices. */
  sections: { label: string; text: string }[];
  signatory: { company: string; name: string; signature: PdfImage | null };
};

const money = (v: number) => formatINR(v);
const discount = (type: string, value: number) => (value > 0 ? (type === "percent" ? `${value}%` : money(value)) : "—");

function DocumentPdf({ doc }: { doc: PdfDoc }) {
  const showTax = doc.gst && doc.supplyType !== "export";
  const t = doc.totals;
  // Column widths (flex); description takes the rest.
  const cols = [
    { key: "#", w: 0.35 },
    { key: "Description", w: 3.2 },
    ...(doc.showSac ? [{ key: "SAC", w: 0.8 }] : []),
    { key: "Qty", w: 0.6, right: true },
    { key: "Rate", w: 1.1, right: true },
    { key: "Disc.", w: 0.9, right: true },
    { key: "Taxable", w: 1.15, right: true },
    ...(showTax ? [{ key: "Tax", w: 1.1, right: true }] : []),
    { key: "Amount", w: 1.2, right: true },
  ];
  const totals: [string, number][] = [
    ["Subtotal", t.subtotal],
    ...(t.discount_total > 0 ? ([["Discount", -t.discount_total]] as [string, number][]) : []),
    ["Taxable value", t.taxable_total],
    ...(showTax && doc.supplyType === "intra" ? ([["CGST", t.cgst_total], ["SGST", t.sgst_total]] as [string, number][]) : []),
    ...(showTax && doc.supplyType === "inter" ? ([["IGST", t.igst_total]] as [string, number][]) : []),
    ...(t.round_off !== 0 ? ([["Round off", t.round_off]] as [string, number][]) : []),
  ];

  return (
    <Document title={`${doc.title} ${doc.number}`} author={doc.company.name}>
      <Page size="A4" style={s.page}>
        {/* Header: company left, document title and meta right */}
        <View style={[s.between, { marginBottom: 18 }]}>
          <View style={{ width: "55%" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            {doc.company.logo && <Image src={doc.company.logo} style={s.logo} />}
            <Text style={[s.bold, s.big]}>{doc.company.name}</Text>
            {doc.company.lines.map((l) => (
              <Text key={l} style={s.muted}>
                {l}
              </Text>
            ))}
          </View>
          <View style={{ width: "40%" }}>
            <Text style={s.title}>{doc.title}</Text>
            <Text style={[s.right, s.bold, { marginBottom: 6 }]}>{doc.number}</Text>
            {doc.meta.map(([k, v]) => (
              <View key={k} style={s.between}>
                <Text style={s.muted}>{k}</Text>
                <Text>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[s.box, { marginBottom: 14 }]}>
          <Text style={s.label}>Bill to</Text>
          <Text style={s.bold}>{doc.billTo.name}</Text>
          {doc.billTo.address && <Text>{doc.billTo.address}</Text>}
          {doc.billTo.gstin && <Text>GSTIN: {doc.billTo.gstin}</Text>}
          {doc.billTo.attention && <Text style={s.muted}>Attn: {doc.billTo.attention}</Text>}
        </View>

        {doc.heading && <Text style={[s.bold, s.big, { marginBottom: 2 }]}>{doc.heading}</Text>}
        {doc.description && <Text style={[s.muted, { marginBottom: 8 }]}>{doc.description}</Text>}

        {/* Line items */}
        <View style={[s.row, s.th]} fixed>
          {cols.map((c) => (
            <Text key={c.key} style={[s.cell, { flex: c.w }, c.right ? s.right : {}]}>
              {c.key}
            </Text>
          ))}
        </View>
        {doc.items.map((i) => {
          const values: Record<string, string> = {
            "#": String(i.position),
            Description: i.description,
            SAC: i.sac_code,
            Qty: String(i.quantity),
            Rate: money(i.unit_price),
            "Disc.": discount(i.discount_type, i.discount_value),
            Taxable: money(i.taxable),
            Tax: `${formatINR(paise(i.cgst) + paise(i.sgst) + paise(i.igst))}\n${i.tax_rate}%`,
            Amount: money(i.line_total),
          };
          return (
            <View key={i.position} style={[s.row, s.tr]} wrap={false}>
              {cols.map((c) => (
                <Text key={c.key} style={[s.cell, { flex: c.w }, c.right ? s.right : {}]}>
                  {values[c.key]}
                </Text>
              ))}
            </View>
          );
        })}

        {/* Totals and amount in words */}
        <View style={[s.between, { marginTop: 12 }]} wrap={false}>
          <View style={{ width: "52%" }}>
            <Text style={s.label}>Amount in words</Text>
            <Text>{amountInWords(paise(t.grand_total))}</Text>
          </View>
          <View style={{ width: "40%" }}>
            {totals.map(([k, v]) => (
              <View key={k} style={[s.between, { paddingVertical: 2 }]}>
                <Text style={s.muted}>{k}</Text>
                <Text>{money(v)}</Text>
              </View>
            ))}
            <View style={[s.between, { borderTopWidth: 1, borderTopColor: INK, marginTop: 4, paddingTop: 4 }]}>
              <Text style={[s.bold, s.big]}>Total</Text>
              <Text style={[s.bold, s.big]}>{money(t.grand_total)}</Text>
            </View>
          </View>
        </View>

        {doc.sections
          .filter((x) => x.text.trim())
          .map((x) => (
            <View key={x.label} style={{ marginTop: 14 }} wrap={false}>
              <Text style={s.label}>{x.label}</Text>
              <Text>{x.text}</Text>
            </View>
          ))}

        {/* Signature */}
        <View style={{ marginTop: 24, alignSelf: "flex-end", width: 200, alignItems: "center" }} wrap={false}>
          <Text style={s.muted}>For {doc.signatory.company}</Text>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
          {doc.signatory.signature ? <Image src={doc.signatory.signature} style={{ maxHeight: 50, maxWidth: 160, marginVertical: 6, objectFit: "contain" }} /> : <View style={{ height: 44 }} />}
          {doc.signatory.name && <Text style={s.bold}>{doc.signatory.name}</Text>}
          <Text style={s.muted}>Authorised Signatory</Text>
        </View>

        <View style={s.footer} fixed>
          <Text>
            {doc.title} {doc.number}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export function renderDocumentPdf(doc: PdfDoc) {
  return renderToBuffer(<DocumentPdf doc={doc} />);
}

/** Company details for the PDF header, with the logo and signature downloaded from the private bucket. */
export async function pdfCompany(
  supabase: SupabaseClient,
  c: {
    legal_name: string;
    trade_name: string;
    address: string;
    city: string;
    state: string;
    pin_code: string;
    country: string;
    email: string;
    phone: string;
    website: string;
    gst_registered: boolean;
    gstin: string;
    logo_path: string | null;
    signature_path: string | null;
    signatory_name: string;
  },
) {
  const image = async (p: string | null): Promise<PdfImage | null> => {
    if (!p) return null;
    const { data } = await supabase.storage.from("branding").download(p);
    return data ? { data: Buffer.from(await data.arrayBuffer()), format: p.endsWith(".png") ? "png" : "jpg" } : null;
  };
  const [logo, signature] = await Promise.all([image(c.logo_path), image(c.signature_path)]);
  const name = c.trade_name || c.legal_name;
  const lines = [
    c.trade_name && c.legal_name !== c.trade_name ? c.legal_name : "",
    c.address,
    [c.city, c.state, c.pin_code].filter(Boolean).join(", "),
    c.country !== "India" ? c.country : "",
    c.gst_registered && c.gstin ? `GSTIN: ${c.gstin}` : "",
    [c.email, c.phone, c.website].filter(Boolean).join(" · "),
  ].filter(Boolean);
  return {
    company: { name, lines, logo },
    signatory: { company: name, name: c.signatory_name, signature },
  };
}

/** PDF download response. */
export function pdfResponse(pdf: Buffer, filename: string) {
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]+/g, "-")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
