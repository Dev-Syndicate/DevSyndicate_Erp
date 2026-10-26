import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getLead, LEAD_VIEWS, listLeads } from "@/features/leads/queries";
import { ACTIVITY_KINDS, activitySchema, LEAD_SOURCES, leadSchema, type LeadInput } from "@/features/leads/schema";
import { getQuotation, listQuotations } from "@/features/quotations/queries";
import { quotationSchema, type QuotationInput } from "@/features/quotations/schema";
import { addDays, istToday } from "@/lib/dates";
import { fieldErrors } from "@/lib/forms";
import { dbErrorMessage } from "@/lib/line-items";
import { createBearerClient, type BearerClient } from "@/lib/supabase/bearer";

// Claude connector tools (PRD §48). Each runs as the signed-in user, so RLS and permissions decide what succeeds.

type Ctx = { http?: { authInfo?: { token: string } } };
type Result = { content: { type: "text"; text: string }[]; isError?: boolean };

const ok = (data: unknown): Result => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
const fail = (message: string): Result => ({ content: [{ type: "text", text: message }], isError: true });
const invalid = (error: z.ZodError) => fail(`Invalid input: ${JSON.stringify(fieldErrors(error))}`);

/** Runs a tool with a database client for the caller; database errors become readable tool errors. */
function run<A>(fn: (args: A, db: BearerClient) => Promise<Result>) {
  return async (args: A, ctx: Ctx): Promise<Result> => {
    const token = ctx.http?.authInfo?.token;
    if (!token) return fail("Not signed in.");
    try {
      return await fn(args, createBearerClient(token));
    } catch (e) {
      return fail(dbErrorMessage(e as { code?: string; message: string }));
    }
  };
}

const READ = { readOnlyHint: true, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const date = z.string().describe("YYYY-MM-DD");
const amount = z.coerce.string().describe('Rupees, up to 2 decimals, e.g. "45000" or "1250.50"');

const leadFields = {
  name: z.string().describe("Person's name"),
  company: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional().describe("Email or phone is required"),
  source: z.enum(LEAD_SOURCES.map((s) => s.value)).optional(),
  source_detail: z.string().optional().describe("Who referred them, profile link, campaign…"),
  status: z.enum(["new", "contacted", "qualified", "lost"]).optional().describe("Won only through mark_lead_won"),
  lost_reason: z.string().optional().describe("Required when status is lost"),
  next_follow_up: date.optional().describe('YYYY-MM-DD, or "" for none'),
  follow_up_note: z.string().optional().describe("What to do at the follow-up"),
  notes: z.string().optional(),
};

/** Lead form values → table row (same shaping as the app's saveLead). */
const leadRow = (l: z.output<typeof leadSchema>) => ({
  ...l,
  lost_reason: l.status === "lost" ? l.lost_reason : null,
  next_follow_up: l.next_follow_up || null,
});

const itemFields = z.object({
  description: z.string(),
  quantity: z.coerce.string(),
  unit_price: amount,
  sac_code: z.string().optional().describe("Defaults to the company's SAC code"),
  timeline: z.string().optional().describe('Estimated time, e.g. "2 weeks"'),
  discount_type: z.enum(["amount", "percent"]).optional(),
  discount_value: z.coerce.string().optional(),
  tax_rate: z.coerce.string().optional().describe("GST %, defaults to the company's default rate"),
});

const quotationFields = {
  client_id: z.uuid().describe("From list_clients"),
  contact_id: z.uuid().optional().describe("A contact of that client, from list_clients"),
  title: z.string(),
  description: z.string().optional(),
  quotation_date: date.optional().describe("Defaults to today"),
  valid_until: date.optional().describe("Defaults to the company's validity period"),
  place_of_supply: z.string().optional().describe("Indian state; defaults to the client's state"),
  discount_type: z.enum(["amount", "percent"]).optional(),
  discount_value: z.coerce.string().optional(),
  terms: z.string().optional().describe("Defaults to the company's quotation terms"),
  notes: z.string().optional(),
  items: z.array(itemFields).min(1),
};

type ItemArgs = z.output<typeof itemFields>;

/** Company defaults for new quotation lines and dates (Settings → Company). */
async function quotationDefaults(db: BearerClient) {
  const { data, error } = await db
    .from("company_settings")
    .select("default_sac_code, quotation_validity_days, quotation_terms, tax_rates(rate)")
    .maybeSingle();
  if (error) throw error;
  return data;
}

const toItem = (i: ItemArgs, sac: string, rate: string): QuotationInput["items"][number] => ({
  description: i.description,
  quantity: i.quantity,
  unit_price: i.unit_price,
  sac_code: i.sac_code ?? sac,
  timeline: i.timeline ?? "",
  discount_type: i.discount_type ?? "amount",
  discount_value: i.discount_value ?? "0",
  tax_rate: i.tax_rate ?? rate,
});

async function saveQuotation(db: BearerClient, id: string | null, input: QuotationInput): Promise<Result> {
  const parsed = quotationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  // Generated types can't mark SQL args nullable; p_id = null creates a new quotation.
  const { data: qid, error } = await db.rpc("save_quotation", { p_id: id as string, p_data: parsed.data });
  if (error) return fail(dbErrorMessage(error));
  const { data } = await db.from("quotations").select("id, status, title, valid_until, grand_total").eq("id", qid).single();
  return ok({ ...data, url: `/finance/quotations/${qid}` });
}

export function registerTools(server: McpServer) {
  // ───────────── Leads ─────────────

  server.registerTool(
    "list_leads",
    {
      title: "List leads",
      description: "Leads, soonest follow-up first. view: open (default), due (follow-up today or overdue), won, lost, all.",
      inputSchema: z.object({
        view: z.enum(LEAD_VIEWS.map((v) => v.value)).optional(),
        search: z.string().optional().describe("Name, company, email or phone"),
        page: z.number().int().min(1).optional(),
      }),
      annotations: READ,
    },
    run(async ({ view, search, page }, db) => ok(await listLeads({ q: search ?? "", page: page ?? 1, view: view ?? "open" }, db))),
  );

  server.registerTool(
    "get_lead",
    { title: "Get lead", description: "One lead with its activity log.", inputSchema: z.object({ id: z.uuid() }), annotations: READ },
    run(async ({ id }, db) => {
      const lead = await getLead(id, db);
      return lead ? ok(lead) : fail("Lead not found.");
    }),
  );

  server.registerTool(
    "create_lead",
    {
      title: "Create lead",
      description:
        "Adds a lead. If someone with the same email or phone exists, returns them instead of saving; confirm with the user, then repeat with allow_duplicate: true.",
      inputSchema: z.object({ ...leadFields, allow_duplicate: z.boolean().optional() }),
      annotations: WRITE,
    },
    run(async ({ allow_duplicate, ...args }, db) => {
      const parsed = leadSchema.safeParse({
        company: "", email: "", phone: "", source: "other", source_detail: "", status: "new", lost_reason: "",
        next_follow_up: "", follow_up_note: "", notes: "", ...args,
      } satisfies LeadInput);
      if (!parsed.success) return invalid(parsed.error);
      if (!allow_duplicate) {
        const { data: duplicates } = await db.rpc("lead_duplicates", { p_email: parsed.data.email, p_phone: parsed.data.phone });
        if (duplicates?.length) return ok({ saved: false, duplicates });
      }
      const { data: org } = await db.rpc("current_org_id");
      if (!org) return fail("You don't have permission to do this.");
      const { data, error } = await db.from("leads").insert({ ...leadRow(parsed.data), organization_id: org }).select("id").single();
      if (error) return fail(dbErrorMessage(error));
      return ok({ saved: true, id: data.id, url: `/leads/${data.id}` });
    }),
  );

  server.registerTool(
    "update_lead",
    {
      title: "Update lead",
      description: "Changes the given fields of an open or lost lead; others stay as they are. Won leads are read-only.",
      inputSchema: z.object({ id: z.uuid(), ...leadFields, name: leadFields.name.optional() }),
      annotations: WRITE,
    },
    run(async ({ id, ...changes }, db) => {
      const lead = await getLead(id, db);
      if (!lead) return fail("Lead not found.");
      const parsed = leadSchema.safeParse({
        name: lead.name, company: lead.company, email: lead.email, phone: lead.phone,
        source: lead.source as LeadInput["source"], source_detail: lead.source_detail,
        status: lead.status as LeadInput["status"], lost_reason: lead.lost_reason ?? "",
        next_follow_up: lead.next_follow_up ?? "", follow_up_note: lead.follow_up_note, notes: lead.notes, ...changes,
      } satisfies LeadInput);
      if (!parsed.success) return invalid(parsed.error);
      const { data, error } = await db.from("leads").update(leadRow(parsed.data)).eq("id", id).select("id, status, next_follow_up");
      if (error) return fail(dbErrorMessage(error));
      return data.length ? ok(data[0]) : fail("This lead is won (read-only), or you can't edit leads.");
    }),
  );

  server.registerTool(
    "log_lead_activity",
    {
      title: "Log lead activity",
      description: `Records a ${ACTIVITY_KINDS.map((k) => k.value).join(" / ")} on a lead. Give next_follow_up to set the next follow-up ("" clears it); leave it out to keep the current one.`,
      inputSchema: z.object({
        lead_id: z.uuid(),
        kind: z.enum(ACTIVITY_KINDS.map((k) => k.value)),
        body: z.string().describe("What happened"),
        next_follow_up: date.optional(),
        follow_up_note: z.string().optional(),
      }),
      annotations: WRITE,
    },
    run(async ({ lead_id, ...args }, db) => {
      const parsed = activitySchema.safeParse({ next_follow_up: "", follow_up_note: "", ...args });
      if (!parsed.success) return invalid(parsed.error);
      const { kind, body, next_follow_up, follow_up_note } = parsed.data;
      const { data: org } = await db.rpc("current_org_id");
      if (!org) return fail("You don't have permission to do this.");
      const { error } = await db.from("lead_activities").insert({ organization_id: org, lead_id, kind, body });
      if (error) return fail(dbErrorMessage(error));
      if (args.next_follow_up !== undefined) {
        const update = await db
          .from("leads")
          .update({ next_follow_up: next_follow_up || null, follow_up_note: next_follow_up ? follow_up_note : "" })
          .eq("id", lead_id)
          .select("id");
        if (update.error || !update.data.length) return fail("The activity was saved, but the follow-up could not be changed.");
      }
      return ok({ saved: true });
    }),
  );

  server.registerTool(
    "mark_lead_won",
    {
      title: "Mark lead as won",
      description: "Converts the lead into a client: a new client (company + this person as primary contact), or links client_id if the client already exists. The lead becomes read-only.",
      inputSchema: z.object({ lead_id: z.uuid(), client_id: z.uuid().optional().describe("Existing client, from list_clients") }),
      annotations: WRITE,
    },
    run(async ({ lead_id, client_id }, db) => {
      // Generated types can't mark SQL args nullable; p_client_id = null creates the client.
      const { data, error } = await db.rpc("convert_lead", { p_id: lead_id, p_client_id: client_id as string });
      if (error) return fail(dbErrorMessage(error));
      return ok({ client_id: data, url: `/clients/${data}` });
    }),
  );

  // ───────────── Quotations ─────────────

  server.registerTool(
    "list_clients",
    {
      title: "List clients",
      description: "Active clients with their contacts (ids for create_quotation and mark_lead_won).",
      inputSchema: z.object({ search: z.string().optional().describe("Company name") }),
      annotations: READ,
    },
    run(async ({ search }, db) => {
      let query = db
        .from("clients")
        .select("id, company_name, city, state, country, gstin, client_contacts(id, name, email, phone, is_primary)")
        .is("deleted_at", null)
        .order("company_name")
        .limit(25);
      if (search?.trim()) query = query.ilike("company_name", `%${search.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return ok(data);
    }),
  );

  server.registerTool(
    "list_quotations",
    {
      title: "List quotations",
      description: "Quotations, newest first, with status and totals (INR).",
      inputSchema: z.object({ search: z.string().optional().describe("Title or number"), page: z.number().int().min(1).optional() }),
      annotations: READ,
    },
    run(async ({ search, page }, db) => ok(await listQuotations({ q: search ?? "", page: page ?? 1 }, db))),
  );

  server.registerTool(
    "get_quotation",
    { title: "Get quotation", description: "One quotation with its lines, client and invoices.", inputSchema: z.object({ id: z.uuid() }), annotations: READ },
    run(async ({ id }, db) => {
      const q = await getQuotation(id, db);
      return q ? ok(q) : fail("Quotation not found.");
    }),
  );

  server.registerTool(
    "create_quotation",
    {
      title: "Create quotation",
      description: "Creates a draft quotation. The database computes discounts, GST and totals. Sending it stays in the app.",
      inputSchema: z.object(quotationFields),
      annotations: WRITE,
    },
    run(async ({ items, ...q }, db) => {
      const d = await quotationDefaults(db);
      const today = istToday();
      const quotationDate = q.quotation_date ?? today;
      return saveQuotation(db, null, {
        client_id: q.client_id,
        contact_id: q.contact_id ?? "",
        quotation_date: quotationDate,
        valid_until: q.valid_until ?? addDays(quotationDate, d?.quotation_validity_days ?? 15),
        title: q.title,
        description: q.description ?? "",
        place_of_supply: q.place_of_supply ?? "",
        discount_type: q.discount_type ?? "amount",
        discount_value: q.discount_value ?? "0",
        terms: q.terms ?? d?.quotation_terms ?? "",
        notes: q.notes ?? "",
        items: items.map((i) => toItem(i, d?.default_sac_code ?? "", String(d?.tax_rates?.rate ?? 0))),
      });
    }),
  );

  server.registerTool(
    "update_quotation",
    {
      title: "Update draft quotation",
      description: "Changes the given fields of a draft quotation. items, when given, replace all lines. Sent quotations can't be edited (revise them in the app).",
      inputSchema: z.object({
        id: z.uuid(),
        ...quotationFields,
        client_id: quotationFields.client_id.optional(),
        title: quotationFields.title.optional(),
        items: quotationFields.items.optional(),
      }),
      annotations: WRITE,
    },
    run(async ({ id, items, ...changes }, db) => {
      const cur = await getQuotation(id, db);
      if (!cur) return fail("Quotation not found.");
      if (cur.status !== "draft") return fail("Only draft quotations can be edited.");
      const d = await quotationDefaults(db);
      const existing = cur.quotation_items.map((i) => ({
        description: i.description, quantity: String(i.quantity), unit_price: String(i.unit_price), sac_code: i.sac_code,
        timeline: i.timeline, discount_type: i.discount_type as "amount" | "percent", discount_value: String(i.discount_value),
        tax_rate: String(i.tax_rate),
      }));
      const strip = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
      // A new client drops the old client's contact unless one is given.
      const clientChanged = !!changes.client_id && changes.client_id !== cur.client_id;
      return saveQuotation(db, id, {
        client_id: cur.client_id,
        contact_id: clientChanged ? "" : (cur.contact_id ?? ""),
        quotation_date: cur.quotation_date,
        valid_until: cur.valid_until,
        title: cur.title,
        description: cur.description,
        place_of_supply: cur.place_of_supply,
        discount_type: cur.discount_type as "amount" | "percent",
        discount_value: String(cur.discount_value),
        terms: cur.terms,
        notes: cur.notes,
        ...strip,
        items: items ? items.map((i) => toItem(i, d?.default_sac_code ?? "", String(d?.tax_rates?.rate ?? 0))) : existing,
      });
    }),
  );
}
