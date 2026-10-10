// Quotation / invoice PDF (PRD §13, §15), rendered on the server with @react-pdf/renderer.
// Layout follows the owner's quotation template: logo + company block, big title, client, project
// description, gridded line table, shaded total, terms, signature over a line with the designation.
// PDFs have no theme: the colours below are print colours, not UI tokens (CLAUDE.md rule 2 covers the app UI).
// Noto Sans is embedded because the built-in PDF fonts have no ₹ glyph (PRD §33).

import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDate } from "@/lib/dates";
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

const INK = "#000000";
const MUTED = "#444444";
const SHADE = "#efefef";

const s = StyleSheet.create({
  page: { fontFamily: "Noto Sans", fontSize: 9, color: INK, paddingHorizontal: 40, paddingTop: 36, paddingBottom: 50, lineHeight: 1.4 },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  bold: { fontWeight: "bold" },
  muted: { color: MUTED },
  small: { fontSize: 7.5, lineHeight: 1.35 },
  logo: { width: 90, height: 90, objectFit: "contain", marginRight: 12 },
  company: { fontSize: 12, fontWeight: "bold", lineHeight: 1.2, marginBottom: 2 },
  title: { fontSize: 20, fontWeight: "bold", lineHeight: 1.2, textAlign: "right", textTransform: "uppercase" },
  thick: { borderBottomWidth: 2, borderBottomColor: INK, marginVertical: 12 },
  table: { borderTopWidth: 1, borderLeftWidth: 1, borderColor: INK },
  tr: { flexDirection: "row" },
  td: { borderRightWidth: 1, borderBottomWidth: 1, borderColor: INK, paddingHorizontal: 5, paddingVertical: 4, justifyContent: "center" },
  th: { fontWeight: "bold", textAlign: "center" },
  heading: { fontSize: 10, fontWeight: "bold", marginBottom: 4 },
  footer: { position: "absolute", bottom: 22, left: 40, right: 40, fontSize: 7.5, color: MUTED, textAlign: "right" },
});

export type PdfImage = { data: Buffer; format: "png" | "jpg" };

type Item = {
  position: number;
  description: string;
  sac_code: string;
  timeline?: string;
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
  /** "Quotation", "Tax Invoice" or "Invoice" (printed in capitals). */
  title: string;
  /** e.g. ["Quotation No", "QT-2026-10-0001"]; drafts pass "DRAFT". */
  number: [string, string];
  /** Right-hand rows, e.g. [["Date", "10/10/2026"], ["Valid Until", "25/10/2026"]]. */
  meta: [string, string][];
  /** Quotations: title and description, shown as "Project Description". */
  project?: { title: string; description: string };
  company: { name: string; lines: string[]; logo: PdfImage | null };
  /** Address lines as they should print (address as entered, then city, state, PIN). */
  billTo: { name: string; lines: string[]; gstin: string; attention?: string };
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
  /** Invoices print the amount in words (PRD §15). */
  amountInWords?: boolean;
  /** Blocks after the totals, e.g. bank details and terms. Empty ones are skipped. */
  sections: { label: string; text: string }[];
  signatory: { name: string; designation: string; signature: PdfImage | null };
};

/** Business date → DD/MM/YYYY, as on the template. */
export const pdfDate = (date: string) => formatDate(date).replaceAll("-", "/");

const discount = (type: string, value: number) => (value > 0 ? (type === "percent" ? `${value}%` : formatINR(value)) : "—");

type Col = { label: string; flex: number; align: "left" | "center" | "right"; value: (i: Item) => string };

function DocumentPdf({ doc }: { doc: PdfDoc }) {
  const showTax = doc.gst && doc.supplyType !== "export";
  const t = doc.totals;
  // Columns appear only when the document uses them, so a simple quote reads S.No | Description | Timeline | Cost.
  const cols: Col[] = [
    { label: "S.No", flex: 0.5, align: "center", value: (i) => String(i.position) },
    { label: "Description of Services / Milestones", flex: 3.4, align: "left", value: (i) => i.description },
    ...(doc.items.some((i) => i.timeline)
      ? [{ label: "Estimated days /\nTimeline", flex: 1.3, align: "center" as const, value: (i: Item) => i.timeline || "—" }]
      : []),
    ...(doc.showSac ? [{ label: "SAC", flex: 0.8, align: "center" as const, value: (i: Item) => i.sac_code }] : []),
    ...(doc.items.some((i) => i.quantity !== 1)
      ? [
          { label: "Qty", flex: 0.6, align: "center" as const, value: (i: Item) => String(i.quantity) },
          { label: "Rate", flex: 1.1, align: "right" as const, value: (i: Item) => formatINR(i.unit_price) },
        ]
      : []),
    ...(doc.items.some((i) => i.discount_value > 0)
      ? [{ label: "Discount", flex: 0.9, align: "right" as const, value: (i: Item) => discount(i.discount_type, i.discount_value) }]
      : []),
    ...(showTax
      ? [
          { label: "Taxable", flex: 1.1, align: "right" as const, value: (i: Item) => formatINR(i.taxable) },
          {
            label: "GST",
            flex: 1.1,
            align: "right" as const,
            value: (i: Item) => `${formatINR(paise(i.cgst) + paise(i.sgst) + paise(i.igst))}\n@ ${i.tax_rate}%`,
          },
        ]
      : []),
    { label: showTax ? "Amount" : "Cost", flex: 1.2, align: "right", value: (i) => formatINR(i.line_total) },
  ];

  const totals: [string, number][] = [
    ["Subtotal", t.subtotal],
    ...(t.discount_total > 0 ? ([["Discount", -t.discount_total], ["Taxable value", t.taxable_total]] as [string, number][]) : []),
    ...(showTax && doc.supplyType === "intra" ? ([["CGST", t.cgst_total], ["SGST", t.sgst_total]] as [string, number][]) : []),
    ...(showTax && doc.supplyType === "inter" ? ([["IGST", t.igst_total]] as [string, number][]) : []),
    ...(t.round_off !== 0 ? ([["Round off", t.round_off]] as [string, number][]) : []),
  ];
  const sections = doc.sections.filter((x) => x.text.trim());

  return (
    <Document title={`${doc.title} ${doc.number[1]}`} author={doc.company.name}>
      <Page size="A4" style={s.page}>
        {/* Logo + company, title */}
        <View style={[s.between, { alignItems: "flex-start" }]}>
          <View style={[s.row, { width: "62%" }]}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            {doc.company.logo && <Image src={doc.company.logo} style={s.logo} />}
            <View style={{ flex: 1 }}>
              <Text style={s.company}>{doc.company.name}</Text>
              {doc.company.lines.map((l) => (
                <Text key={l} style={s.small}>
                  {l}
                </Text>
              ))}
            </View>
          </View>
          <Text style={[s.title, { marginTop: 14 }]}>{doc.title}</Text>
        </View>

        {/* Number and dates */}
        <View style={[s.between, { marginTop: 18 }]}>
          <Text>
            {doc.number[0]}: {doc.number[1]}
          </Text>
          <View>
            {doc.meta.map(([k, v]) => (
              <Text key={k}>
                {k}: {v}
              </Text>
            ))}
          </View>
        </View>

        {/* Client */}
        <View style={{ marginTop: 6, width: "50%" }}>
          <Text style={[s.bold, { textTransform: "uppercase" }]}>{doc.billTo.name}</Text>
          {doc.billTo.lines.filter(Boolean).map((l, n) => (
            <Text key={n}>{l}</Text>
          ))}
          {doc.billTo.gstin && <Text>GSTIN: {doc.billTo.gstin}</Text>}
          {doc.billTo.attention && <Text>Attn: {doc.billTo.attention}</Text>}
        </View>

        <View style={s.thick} />

        {doc.project && (
          <View style={[s.row, { marginBottom: 12 }]} wrap={false}>
            <Text style={[s.bold, { width: "30%", paddingLeft: 14 }]}>Project Description</Text>
            <View style={{ width: "70%" }}>
              <Text style={s.bold}>{doc.project.title}</Text>
              {doc.project.description && <Text>{doc.project.description}</Text>}
            </View>
          </View>
        )}

        {/* Line items: full grid */}
        <View style={s.table}>
          <View style={s.tr} fixed>
            {cols.map((c) => (
              <View key={c.label} style={[s.td, { flex: c.flex }]}>
                <Text style={s.th}>{c.label}</Text>
              </View>
            ))}
          </View>
          {doc.items.map((i) => (
            <View key={i.position} style={s.tr} wrap={false}>
              {cols.map((c) => (
                <View key={c.label} style={[s.td, { flex: c.flex }]}>
                  <Text style={{ textAlign: c.align }}>{c.value(i)}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={{ alignSelf: "flex-end", width: 210, marginTop: 10 }} wrap={false}>
          {totals.map(([k, v]) => (
            <View key={k} style={[s.between, { paddingVertical: 2, paddingHorizontal: 6 }]}>
              <Text style={s.bold}>{k}</Text>
              <Text>{formatINR(v)}</Text>
            </View>
          ))}
          <View style={[s.between, { paddingVertical: 3, paddingHorizontal: 6 }]}>
            <Text style={s.bold}>Total</Text>
            <Text style={[s.bold, { backgroundColor: SHADE, paddingHorizontal: 6 }]}>{formatINR(t.grand_total)}</Text>
          </View>
        </View>
        {doc.amountInWords && (
          <Text style={{ marginTop: 6 }}>
            <Text style={s.bold}>Amount in words: </Text>
            {amountInWords(paise(t.grand_total))}
          </Text>
        )}

        <View style={s.thick} />

        {sections.map((x) => (
          <View key={x.label} style={{ marginBottom: 10 }} wrap={false}>
            <Text style={s.heading}>{x.label}:</Text>
            <Text style={[s.small, { textAlign: "justify" }]}>{x.text}</Text>
          </View>
        ))}

        {/* Signature over a line, designation below */}
        <View style={{ alignSelf: "flex-end", width: 190, marginTop: 16, alignItems: "center" }} wrap={false}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
          {doc.signatory.signature ? <Image src={doc.signatory.signature} style={{ height: 44, maxWidth: 160, objectFit: "contain" }} /> : <View style={{ height: 44 }} />}
          <View style={{ borderTopWidth: 1, borderTopColor: INK, alignSelf: "stretch", marginTop: 4, marginBottom: 4 }} />
          {doc.signatory.name && <Text style={s.bold}>{doc.signatory.name}</Text>}
          <Text style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>{doc.signatory.designation || "Authorised Signatory"}</Text>
        </View>

        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => (totalPages > 1 ? `Page ${pageNumber} of ${totalPages}` : "")} />
      </Page>
    </Document>
  );
}

export function renderDocumentPdf(doc: PdfDoc) {
  return renderToBuffer(<DocumentPdf doc={doc} />);
}

/** Company block and signatory for the PDF, with the logo and signature downloaded from the private bucket. */
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
    signatory_designation: string;
  },
) {
  const image = async (p: string | null): Promise<PdfImage | null> => {
    if (!p) return null;
    const { data } = await supabase.storage.from("branding").download(p);
    return data ? { data: Buffer.from(await data.arrayBuffer()), format: p.endsWith(".png") ? "png" : "jpg" } : null;
  };
  const [logo, signature] = await Promise.all([image(c.logo_path), image(c.signature_path)]);
  const lines = [
    c.trade_name && c.legal_name !== c.trade_name ? c.legal_name : "",
    [c.address, c.city, c.state].filter(Boolean).join(", "),
    [c.pin_code && `${c.pin_code}.`, c.country !== "India" ? c.country : ""].filter(Boolean).join(" "),
    c.phone && `Mobile: ${c.phone}`,
    c.email && `Email: ${c.email}`,
    c.website && `Website: ${c.website}`,
    c.gst_registered && c.gstin ? `GSTIN: ${c.gstin}` : "",
  ].filter(Boolean);
  return {
    company: { name: c.trade_name || c.legal_name, lines, logo },
    signatory: { name: c.signatory_name, designation: c.signatory_designation, signature },
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
