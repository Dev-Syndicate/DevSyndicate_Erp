import { formatDate, istToday } from "@/lib/dates";
import { paise } from "@/lib/money";
import { methodLabel } from "@/lib/payment-methods";
import { createClient } from "@/lib/supabase/server";
import { monthLabel, totalRow, type Column, type Report, type ReportName, type ReportTable, type Row } from "./utils";

export type ReportParams = { from: string; to: string; clientId?: string; categoryId?: string };

// shortcut: registers are capped by the API's max rows (1,000 by default); page through them if a year ever has more.
const MAX = 5000;
const money = (v: number | null) => paise(v ?? 0);
const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

function table(title: string, columns: Column[], rows: Row[], opts: { description?: string; total?: boolean; empty?: string } = {}): ReportTable {
  return { title, columns, rows, description: opts.description, empty: opts.empty, total: opts.total && rows.length ? totalRow(columns, rows) : undefined };
}

export async function getReportOptions() {
  const supabase = await createClient();
  const [clients, categories, settings] = await Promise.all([
    supabase.from("clients").select("id, company_name").order("company_name"),
    supabase.from("expense_categories").select("id, name").order("name"),
    supabase.from("company_settings").select("gst_registered").maybeSingle(),
  ]);
  return { clients: clients.data ?? [], categories: categories.data ?? [], gstRegistered: settings.data?.gst_registered ?? false };
}

export async function buildReport(name: ReportName, p: ReportParams): Promise<Report> {
  const supabase = await createClient();

  switch (name) {
    case "revenue": {
      const [monthly, byClient, register] = await Promise.all([
        supabase.rpc("report_monthly", { p_from: p.from, p_to: p.to }),
        supabase.rpc("report_revenue_by_client", { p_from: p.from, p_to: p.to }),
        supabase
          .from("payments")
          .select("id, number, kind, payment_date, amount, tds_amount, method, reference, clients(company_name)")
          .eq("status", "confirmed").gte("payment_date", p.from).lte("payment_date", p.to)
          .order("payment_date").order("number").limit(MAX),
      ]);
      const cols: Column[] = [
        { key: "received", label: "Received", kind: "money" },
        { key: "tds", label: "TDS", kind: "money" },
        { key: "refunds", label: "Refunds", kind: "money" },
        { key: "revenue", label: "Revenue", kind: "money" },
      ];
      const figures = (r: { received: number; tds: number; refunds: number }) => ({
        received: money(r.received), tds: money(r.tds), refunds: money(r.refunds), revenue: money(r.received) + money(r.tds) - money(r.refunds),
      });
      const registerCols: Column[] = [
        { key: "date", label: "Date", kind: "date" },
        { key: "number", label: "Receipt" },
        { key: "type", label: "Type" },
        { key: "client", label: "Client" },
        { key: "method", label: "Method" },
        { key: "reference", label: "Reference" },
        { key: "received", label: "Amount", kind: "money" },
        { key: "tds", label: "TDS", kind: "money" },
        { key: "revenue", label: "Revenue", kind: "money" },
      ];
      const registerRows: Row[] = (register.data ?? []).map((r) => {
        const refund = r.kind === "refund";
        return {
          href: `/finance/payments/${r.id}`,
          date: r.payment_date, number: r.number, type: refund ? "Refund" : "Receipt", client: r.clients?.company_name ?? "",
          method: methodLabel(r.method), reference: r.reference, received: money(r.amount), tds: money(r.tds_amount),
          revenue: refund ? -money(r.amount) : money(r.amount) + money(r.tds_amount),
        };
      });
      const registerTable = table("Receipts and refunds", registerCols, registerRows, { total: true, empty: "No confirmed payments in this period." });
      return {
        tables: [
          table("By month", [{ key: "month", label: "Month" }, ...cols], (monthly.data ?? []).map((r) => ({ month: monthLabel(r.month), ...figures(r) })), {
            total: true,
            description: "Revenue = money received + TDS deducted by clients − refunds, by payment date (cash basis).",
          }),
          table("By client", [{ key: "client", label: "Client" }, ...cols], (byClient.data ?? []).map((r) => ({ href: `/clients/${r.client_id}`, client: r.client, ...figures(r) })), {
            total: true,
            empty: "No confirmed payments in this period.",
          }),
          registerTable,
        ],
        csv: registerTable,
      };
    }

    case "expenses": {
      let q = supabase
        .from("expenses")
        .select("id, number, expense_date, description, vendor_invoice_number, amount, gst_amount, itc_eligible, reverse_charge, tds_amount, method, reference, expense_categories(name), vendors(name, gstin)")
        .gte("expense_date", p.from).lte("expense_date", p.to)
        .order("expense_date").order("number").limit(MAX);
      if (p.categoryId) q = q.eq("category_id", p.categoryId);
      const [monthly, byCategory, register] = await Promise.all([
        supabase.rpc("report_monthly", { p_from: p.from, p_to: p.to }),
        supabase.rpc("report_expenses_by_category", { p_from: p.from, p_to: p.to }),
        q,
      ]);
      const registerCols: Column[] = [
        { key: "date", label: "Date", kind: "date" },
        { key: "number", label: "Expense" },
        { key: "category", label: "Category" },
        { key: "vendor", label: "Vendor" },
        { key: "gstin", label: "Vendor GSTIN" },
        { key: "bill", label: "Vendor bill no." },
        { key: "description", label: "Description" },
        { key: "amount", label: "Bill total", kind: "money" },
        { key: "gst", label: "GST", kind: "money" },
        { key: "itc", label: "ITC claimed" },
        { key: "rcm", label: "Reverse charge" },
        { key: "tds", label: "TDS", kind: "money" },
        { key: "paid", label: "Paid to vendor", kind: "money" },
        { key: "method", label: "Method" },
        { key: "reference", label: "Reference" },
      ];
      const registerRows: Row[] = (register.data ?? []).map((e) => ({
        href: `/finance/expenses/${e.id}`,
        date: e.expense_date, number: e.number, category: e.expense_categories?.name ?? "", vendor: e.vendors?.name ?? "",
        gstin: e.vendors?.gstin ?? "", bill: e.vendor_invoice_number, description: e.description, amount: money(e.amount),
        gst: money(e.gst_amount), itc: e.itc_eligible ? "Yes" : "No", rcm: e.reverse_charge ? "Yes" : "No", tds: money(e.tds_amount),
        paid: money(e.amount) - money(e.tds_amount), method: methodLabel(e.method), reference: e.reference,
      }));
      const registerTable = table("Expense register", registerCols, registerRows, { total: true, empty: "No expenses in this period." });
      return {
        tables: [
          table("By month", [{ key: "month", label: "Month" }, { key: "expenses", label: "Expenses", kind: "money" }],
            (monthly.data ?? []).map((r) => ({ month: monthLabel(r.month), expenses: money(r.expenses) })), { total: true, description: "Bill totals including GST, by date paid." }),
          table("By category", [
            { key: "category", label: "Category" }, { key: "count", label: "Bills", kind: "number" },
            { key: "amount", label: "Amount", kind: "money" }, { key: "gst", label: "GST", kind: "money" }, { key: "tds", label: "TDS", kind: "money" },
          ], (byCategory.data ?? []).map((r) => ({ category: r.category, count: r.count, amount: money(r.amount), gst: money(r.gst), tds: money(r.tds) })), {
            total: true,
            empty: "No expenses in this period.",
          }),
          registerTable,
        ],
        csv: registerTable,
      };
    }

    case "profit": {
      const { data } = await supabase.rpc("report_monthly", { p_from: p.from, p_to: p.to });
      const cols: Column[] = [
        { key: "month", label: "Month" },
        { key: "revenue", label: "Revenue", kind: "money" },
        { key: "expenses", label: "Expenses", kind: "money" },
        { key: "profit", label: "Net profit", kind: "money" },
      ];
      const rows: Row[] = (data ?? []).map((r) => {
        const revenue = money(r.received) + money(r.tds) - money(r.refunds);
        return { month: monthLabel(r.month), revenue, expenses: money(r.expenses), profit: revenue - money(r.expenses) };
      });
      const t = table("Profit by month", cols, rows, { total: true, description: "Revenue − expenses on a cash basis (PRD §9.2). Includes GST while the company is not GST-registered." });
      return { tables: [t], csv: t };
    }

    case "outstanding": {
      let q = supabase
        .from("invoices")
        .select("id, number, invoice_date, due_date, grand_total, amount_credited, amount_paid, balance_due, clients(company_name)")
        .eq("status", "issued").gt("balance_due", 0).order("invoice_date").limit(MAX);
      if (p.clientId) q = q.eq("client_id", p.clientId);
      const { data } = await q;
      const today = istToday();
      const bucket = (age: number) => (age <= 30 ? "0–30 days" : age <= 60 ? "31–60 days" : age <= 90 ? "61–90 days" : "Over 90 days");
      const rows: Row[] = (data ?? []).map((i) => {
        const age = days(i.invoice_date, today);
        return {
          href: `/finance/invoices/${i.id}`,
          client: i.clients?.company_name ?? "", number: i.number, date: i.invoice_date, due: i.due_date,
          total: money(i.grand_total), credited: money(i.amount_credited), paid: money(i.amount_paid), balance: money(i.balance_due),
          age, bucket: bucket(age), overdue: i.due_date && i.due_date < today ? `${days(i.due_date, today)} days` : "",
        };
      });
      const detail = table("Unpaid invoices", [
        { key: "client", label: "Client" }, { key: "number", label: "Invoice" }, { key: "date", label: "Invoice date", kind: "date" },
        { key: "due", label: "Due date", kind: "date" }, { key: "total", label: "Total", kind: "money" }, { key: "credited", label: "Credited", kind: "money" },
        { key: "paid", label: "Paid", kind: "money" }, { key: "balance", label: "Balance", kind: "money" }, { key: "age", label: "Age (days)", kind: "number" },
        { key: "bucket", label: "Age bucket" }, { key: "overdue", label: "Overdue by" },
      ], rows, { total: true, empty: "Nothing unpaid.", description: `As of ${formatDate(today)}. Age counts from the invoice date (due dates are optional).` });
      const buckets = ["0–30 days", "31–60 days", "61–90 days", "Over 90 days"].map((b) => ({
        bucket: b,
        count: rows.filter((r) => r.bucket === b).length,
        balance: rows.filter((r) => r.bucket === b).reduce((s, r) => s + (r.balance as bigint), 0n),
      }));
      return {
        tables: [
          table("By age", [{ key: "bucket", label: "Age" }, { key: "count", label: "Invoices", kind: "number" }, { key: "balance", label: "Balance", kind: "money" }], buckets, { total: true }),
          detail,
        ],
        csv: detail,
      };
    }

    case "sales": {
      let inv = supabase
        .from("invoices")
        .select("id, number, invoice_date, billing_name, billing_gstin, place_of_supply, supply_type, taxable_total, cgst_total, sgst_total, igst_total, grand_total, clients(state)")
        .eq("status", "issued").gte("invoice_date", p.from).lte("invoice_date", p.to).limit(MAX);
      let cn = supabase
        .from("credit_notes")
        .select("id, number, credit_note_date, billing_name, billing_gstin, place_of_supply, supply_type, taxable_total, cgst_total, sgst_total, igst_total, grand_total, clients(state), invoices(number)")
        .eq("status", "issued").gte("credit_note_date", p.from).lte("credit_note_date", p.to).limit(MAX);
      if (p.clientId) {
        inv = inv.eq("client_id", p.clientId);
        cn = cn.eq("client_id", p.clientId);
      }
      const [invoices, notes] = await Promise.all([inv, cn]);
      const place = (d: { supply_type: string; place_of_supply: string; clients: { state: string } | null }) =>
        d.supply_type === "export" ? "Outside India" : d.place_of_supply || d.clients?.state || "";
      const rows: Row[] = [
        ...(invoices.data ?? []).map((d) => ({
          href: `/finance/invoices/${d.id}`, date: d.invoice_date, number: d.number, type: "Invoice", against: "", client: d.billing_name,
          gstin: d.billing_gstin, place: place(d), taxable: money(d.taxable_total), cgst: money(d.cgst_total), sgst: money(d.sgst_total),
          igst: money(d.igst_total), total: money(d.grand_total),
        })),
        // Credit notes reduce sales, so they are negative.
        ...(notes.data ?? []).map((d) => ({
          href: `/finance/credit-notes/${d.id}`, date: d.credit_note_date, number: d.number, type: "Credit note", against: d.invoices?.number ?? "",
          client: d.billing_name, gstin: d.billing_gstin, place: place(d), taxable: -money(d.taxable_total), cgst: -money(d.cgst_total),
          sgst: -money(d.sgst_total), igst: -money(d.igst_total), total: -money(d.grand_total),
        })),
      ].sort((a, b) => a.date.localeCompare(b.date) || String(a.number).localeCompare(String(b.number)));
      const hasTax = rows.some((r) => r.cgst !== 0n || r.sgst !== 0n || r.igst !== 0n);
      const cols: Column[] = [
        { key: "date", label: "Date", kind: "date" }, { key: "number", label: "Number" }, { key: "type", label: "Type" },
        { key: "against", label: "Against invoice" }, { key: "client", label: "Client" }, { key: "gstin", label: "GSTIN" },
        { key: "place", label: "Place of supply" }, { key: "taxable", label: "Taxable value", kind: "money" },
        ...(hasTax
          ? ([{ key: "cgst", label: "CGST", kind: "money" }, { key: "sgst", label: "SGST", kind: "money" }, { key: "igst", label: "IGST", kind: "money" }] as Column[])
          : []),
        { key: "total", label: "Total", kind: "money" },
      ];
      const t = table("Sales register", cols, rows, {
        total: true,
        empty: "No invoices or credit notes in this period.",
        description: "Issued invoices and credit notes by document date, as your accountant needs for GSTR-1 and the books. Cancelled invoices are left out.",
      });
      return { tables: [t], csv: t };
    }

    case "tds": {
      const [received, withheld] = await Promise.all([
        supabase
          .from("payments")
          .select("id, number, payment_date, amount, tds_amount, clients(company_name)")
          .eq("status", "confirmed").eq("kind", "receipt").gt("tds_amount", 0)
          .gte("payment_date", p.from).lte("payment_date", p.to).order("payment_date").limit(MAX),
        supabase
          .from("expenses")
          .select("id, number, expense_date, amount, tds_amount, vendors(name)")
          .gt("tds_amount", 0).gte("expense_date", p.from).lte("expense_date", p.to).order("expense_date").limit(MAX),
      ]);
      const cols: Column[] = [
        { key: "date", label: "Date", kind: "date" }, { key: "number", label: "Document" }, { key: "party", label: "Party" },
        { key: "gross", label: "Amount before TDS", kind: "money" }, { key: "tds", label: "TDS", kind: "money" }, { key: "net", label: "Cash", kind: "money" },
      ];
      const byClients: Row[] = (received.data ?? []).map((r) => ({
        href: `/finance/payments/${r.id}`, type: "Deducted by client", date: r.payment_date, number: r.number, party: r.clients?.company_name ?? "",
        gross: money(r.amount) + money(r.tds_amount), tds: money(r.tds_amount), net: money(r.amount),
      }));
      const byUs: Row[] = (withheld.data ?? []).map((e) => ({
        href: `/finance/expenses/${e.id}`, type: "Deducted by us", date: e.expense_date, number: e.number, party: e.vendors?.name ?? "",
        gross: money(e.amount), tds: money(e.tds_amount), net: money(e.amount) - money(e.tds_amount),
      }));
      return {
        tables: [
          table("TDS deducted by clients (receivable)", cols, byClients, {
            total: true, empty: "No TDS deducted by clients in this period.",
            description: "Match these against Form 26AS / AIS before filing your income tax return; the TDS is credited to you there.",
          }),
          table("TDS deducted by you (payable)", cols, byUs, {
            total: true, empty: "No TDS deducted from vendors in this period.",
            description: "Deposit by the 7th of the next month and file the quarterly TDS return.",
          }),
        ],
        csv: table("TDS", [{ key: "type", label: "Type" }, ...cols], [...byClients, ...byUs]),
      };
    }

    case "tax": {
      const { data } = await supabase.rpc("report_tax_summary", { p_from: p.from, p_to: p.to });
      const rows: Row[] = (data ?? []).map((r) => {
        const output = money(r.cgst) + money(r.sgst) + money(r.igst);
        return {
          month: monthLabel(r.month), taxable: money(r.taxable), cgst: money(r.cgst), sgst: money(r.sgst), igst: money(r.igst), output,
          input: money(r.input_gst), rcm: money(r.reverse_charge_gst), net: output + money(r.reverse_charge_gst) - money(r.input_gst),
        };
      });
      const t = table("GST summary", [
        { key: "month", label: "Month" }, { key: "taxable", label: "Taxable value", kind: "money" }, { key: "cgst", label: "CGST", kind: "money" },
        { key: "sgst", label: "SGST", kind: "money" }, { key: "igst", label: "IGST", kind: "money" }, { key: "output", label: "Output GST", kind: "money" },
        { key: "input", label: "Input GST (ITC)", kind: "money" }, { key: "rcm", label: "Reverse charge GST", kind: "money" }, { key: "net", label: "Net GST", kind: "money" },
      ], rows, {
        total: true,
        description: "Output GST on invoices − credit notes, plus reverse-charge GST, minus input tax credit claimed on expenses. For reference: file from the GST portal after matching GSTR-2B.",
      });
      return { tables: [t], csv: t };
    }
  }
}
