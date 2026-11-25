import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getPost, listCategories, listPosts } from "@/features/blog/queries";
import { categorySchema, POST_STATUSES, postSchema, type PostInput } from "@/features/blog/schema";
import { clientSchema, contactSchema } from "@/features/clients/schema";
import { getLead, LEAD_VIEWS, listLeads } from "@/features/leads/queries";
import { ACTIVITY_KINDS, activitySchema, CALL_OUTCOMES, LEAD_SOURCES, leadRow, leadSchema, LOST_REASONS, lostSchema, OPEN_STATUSES, type LeadInput } from "@/features/leads/schema";
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
  phone: z.string().optional().describe("Email or phone is required, unless source is instagram or linkedin with source_detail set"),
  source: z.enum(LEAD_SOURCES.map((s) => s.value)).optional(),
  source_detail: z.string().optional().describe("Who referred them, handle or profile link, campaign…"),
  status: z.enum(["new", "contacted", "qualified"]).optional().describe("Lost only through mark_lead_lost, won through mark_lead_won"),
  next_follow_up: date.optional().describe('YYYY-MM-DD, or "" for none'),
  follow_up_note: z.string().optional().describe("What to do at the follow-up"),
  notes: z.string().optional(),
};

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

const postFields = {
  title: z.string().describe("Headline (H1), up to 200 characters"),
  category_id: z.uuid().describe("From list_blog_categories"),
  content: z.string().describe("Body as HTML using only <p> <h2> <h3> <h4> <strong> <em> <u> <s> <a href> <ul> <ol> <li> <blockquote> <code> <pre> <hr>; no title (H1), images, styles or classes"),
  excerpt: z.string().optional().describe("1-2 sentence summary, up to 300 characters"),
  slug: z.string().optional().describe("lowercase-with-dashes; made from the title when left out"),
  seo_title: z.string().optional().describe("About 50-60 characters with the main keyword; empty uses the title"),
  meta_description: z.string().optional().describe("About 140-155 characters; empty uses the excerpt"),
  canonical_url: z.string().optional().describe("Only if the post first appeared on another site"),
};
const clientFields = {
  company_name: z.string().describe("Company or person billed"),
  billing_address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional().describe('Indian state name, e.g. "Tamil Nadu" (sets GST place of supply)'),
  country: z.string().optional().describe('Defaults to "India"'),
  pin_code: z.string().optional().describe("6 digits in India"),
  gstin: z.string().optional().describe("15 characters; its first 2 digits must match the state"),
  payment_terms_days: z.number().int().min(0).max(365).optional(),
  notes: z.string().optional(),
};
const EMPTY_CLIENT = { billing_address: "", city: "", state: "", country: "India", pin_code: "", gstin: "", notes: "" };
const contactFields = z.object({ name: z.string(), designation: z.string().optional(), email: z.string().optional(), phone: z.string().optional() });

const EMPTY_POST = { slug: "", excerpt: "", seo_title: "", meta_description: "", canonical_url: "" };

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
        search: z.string().optional().describe("Name, company, email, phone or handle"),
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
        "Adds a lead. If someone with the same email, phone or handle exists, returns them instead of saving; confirm with the user, then repeat with allow_duplicate: true.",
      inputSchema: z.object({ ...leadFields, allow_duplicate: z.boolean().optional() }),
      annotations: WRITE,
    },
    run(async ({ allow_duplicate, ...args }, db) => {
      const parsed = leadSchema.safeParse({
        company: "", email: "", phone: "", source: "other", source_detail: "", status: "new", lost_reason: "", lost_note: "",
        next_follow_up: "", follow_up_note: "", notes: "", ...args,
      } satisfies LeadInput);
      if (!parsed.success) return invalid(parsed.error);
      if (!allow_duplicate) {
        const { data: duplicates } = await db.rpc("lead_duplicates", { p_email: parsed.data.email, p_phone: parsed.data.phone, p_source: parsed.data.source, p_source_detail: parsed.data.source_detail });
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
        status: lead.status as LeadInput["status"], lost_reason: (lead.lost_reason ?? "") as LeadInput["lost_reason"], lost_note: lead.lost_note,
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
      description: `Records a ${ACTIVITY_KINDS.map((k) => k.value).join(" / ")} on a lead. Calls need an outcome; only "reached" (or a meeting, email or message) moves a New lead to Contacted. Give next_follow_up to set the next follow-up of an open lead ("" clears it); leave it out to keep the current one. After no_answer or busy, suggest trying again tomorrow.`,
      inputSchema: z.object({
        lead_id: z.uuid(),
        kind: z.enum(ACTIVITY_KINDS.map((k) => k.value)),
        outcome: z.enum(CALL_OUTCOMES.map((o) => o.value)).optional().describe("Calls only, required for calls"),
        body: z.string().describe("What happened"),
        next_follow_up: date.optional(),
        follow_up_note: z.string().optional(),
      }),
      annotations: WRITE,
    },
    run(async ({ lead_id, ...args }, db) => {
      const parsed = activitySchema.safeParse({ outcome: "", next_follow_up: "", follow_up_note: "", ...args });
      if (!parsed.success) return invalid(parsed.error);
      const { kind, outcome, body, next_follow_up, follow_up_note } = parsed.data;
      const { data: org } = await db.rpc("current_org_id");
      if (!org) return fail("You don't have permission to do this.");
      const { error } = await db.from("lead_activities").insert({ organization_id: org, lead_id, kind, body, outcome: kind === "call" ? outcome : null });
      if (error) return fail(dbErrorMessage(error));
      if (args.next_follow_up !== undefined) {
        const update = await db
          .from("leads")
          .update({ next_follow_up: next_follow_up || null, follow_up_note: next_follow_up ? follow_up_note : "" })
          .eq("id", lead_id)
          .in("status", OPEN_STATUSES)
          .select("id");
        if (update.error || !update.data.length) return fail("The activity was saved, but the follow-up wasn't changed: the lead isn't open.");
      }
      return ok({ saved: true });
    }),
  );

  server.registerTool(
    "mark_lead_lost",
    {
      title: "Mark lead as lost",
      description: `Marks an open lead as lost with a reason: ${LOST_REASONS.map((r) => r.value).join(", ")}. other needs a note. bad_timing needs try_again_on: the lead returns in follow-ups due on that date. Reopen with update_lead (status).`,
      inputSchema: z.object({
        lead_id: z.uuid(),
        reason: z.enum(LOST_REASONS.map((r) => r.value)),
        note: z.string().optional(),
        try_again_on: date.optional().describe("bad_timing only"),
      }),
      annotations: WRITE,
    },
    run(async ({ lead_id, reason, note, try_again_on }, db) => {
      const parsed = lostSchema.safeParse({ lost_reason: reason, lost_note: note ?? "", next_follow_up: try_again_on ?? "" });
      if (!parsed.success) return invalid(parsed.error);
      const badTiming = reason === "bad_timing";
      const { data, error } = await db
        .from("leads")
        .update({ status: "lost", lost_reason: reason, lost_note: parsed.data.lost_note, next_follow_up: badTiming ? try_again_on : null, follow_up_note: badTiming ? "Try again" : "" })
        .eq("id", lead_id)
        .in("status", OPEN_STATUSES)
        .select("id, status, lost_reason, next_follow_up");
      if (error) return fail(dbErrorMessage(error));
      return data.length ? ok(data[0]) : fail("Lead not found or not open.");
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

  // ───────────── Clients ─────────────

  server.registerTool(
    "get_client",
    { title: "Get client", description: "One client with all its details and contacts.", inputSchema: z.object({ id: z.uuid() }), annotations: READ },
    run(async ({ id }, db) => {
      const { data, error } = await db.from("clients").select("*, client_contacts(*)").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? ok({ ...data, url: `/clients/${id}` }) : fail("Client not found.");
    }),
  );

  server.registerTool(
    "create_client",
    {
      title: "Create client",
      description:
        "Adds a client, with an optional primary contact. If an active client with the same company name exists, returns it instead of saving; confirm with the user, then repeat with allow_duplicate: true.",
      inputSchema: z.object({ ...clientFields, contact: contactFields.optional().describe("Primary contact"), allow_duplicate: z.boolean().optional() }),
      annotations: WRITE,
    },
    run(async ({ contact, allow_duplicate, ...args }, db) => {
      const client = clientSchema.safeParse({ ...EMPTY_CLIENT, ...args, payment_terms_days: args.payment_terms_days ?? "" });
      if (!client.success) return invalid(client.error);
      const primary = contact && contactSchema.safeParse({ designation: "", email: "", phone: "", ...contact, is_primary: true });
      if (primary && !primary.success) return invalid(primary.error);
      if (!allow_duplicate) {
        const { data: duplicates } = await db.from("clients").select("id, company_name, city").ilike("company_name", client.data.company_name.replace(/[\\%_]/g, "\\$&")).is("deleted_at", null);
        if (duplicates?.length) return ok({ saved: false, duplicates });
      }
      const { data: org } = await db.rpc("current_org_id");
      if (!org) return fail("You don't have permission to do this.");
      const { data, error } = await db.from("clients").insert({ ...client.data, organization_id: org }).select("id").single();
      if (error) return fail(dbErrorMessage(error));
      if (primary) {
        const added = await db.from("client_contacts").insert({ ...primary.data, client_id: data.id, organization_id: org });
        if (added.error) return ok({ saved: true, id: data.id, url: `/clients/${data.id}`, warning: "The client was saved but the contact wasn't; add it in the app." });
      }
      return ok({ saved: true, id: data.id, url: `/clients/${data.id}` });
    }),
  );

  server.registerTool(
    "update_client",
    {
      title: "Update client",
      description: "Changes the given fields of a client; others stay as they are. Contacts: use save_client_contact.",
      inputSchema: z.object({ id: z.uuid(), ...clientFields, company_name: clientFields.company_name.optional() }),
      annotations: WRITE,
    },
    run(async ({ id, ...changes }, db) => {
      const { data: cur, error: readError } = await db
        .from("clients")
        .select("company_name, billing_address, city, state, country, pin_code, gstin, payment_terms_days, notes, deleted_at")
        .eq("id", id)
        .maybeSingle();
      if (readError) throw readError;
      if (!cur) return fail("Client not found.");
      // The app shows archived clients read-only; RLS alone would allow the edit.
      const { deleted_at, ...fields } = cur;
      if (deleted_at) return fail("This client is archived. Restore it in the app first.");
      const strip = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
      const client = clientSchema.safeParse({ ...fields, payment_terms_days: fields.payment_terms_days ?? "", ...strip });
      if (!client.success) return invalid(client.error);
      const { data, error } = await db.from("clients").update(client.data).eq("id", id).is("deleted_at", null).select("id, company_name");
      if (error) return fail(dbErrorMessage(error));
      return data.length ? ok({ ...data[0], url: `/clients/${id}` }) : fail("You can't edit clients.");
    }),
  );

  server.registerTool(
    "save_client_contact",
    {
      title: "Add or edit client contact",
      description:
        "Adds a contact to a client, or edits one when contact_id is given (only the fields given change). A client can have many contacts: call once per contact. is_primary: true makes it the primary contact (the others stop being primary); false removes primary from it.",
      inputSchema: z.object({
        client_id: z.uuid(),
        contact_id: z.uuid().optional().describe("From get_client; leave out to add a new contact"),
        ...contactFields.shape,
        name: contactFields.shape.name.optional().describe("Required when adding"),
        is_primary: z.boolean().optional().describe("A client's first contact is primary by default"),
      }),
      annotations: WRITE,
    },
    run(async ({ client_id, contact_id, ...changes }, db) => {
      const { data: client, error: readError } = await db
        .from("clients")
        .select("organization_id, deleted_at, client_contacts(id, name, designation, email, phone, is_primary)")
        .eq("id", client_id)
        .maybeSingle();
      if (readError) throw readError;
      if (!client) return fail("Client not found.");
      // The app shows archived clients read-only.
      if (client.deleted_at) return fail("This client is archived. Restore it in the app first.");
      const cur = contact_id ? client.client_contacts.find((c) => c.id === contact_id) : undefined;
      if (contact_id && !cur) return fail("Contact not found on this client.");
      const strip = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
      // A client's first contact is primary unless told otherwise.
      const contact = contactSchema.safeParse({ name: "", designation: "", email: "", phone: "", is_primary: client.client_contacts.length === 0, ...cur, ...strip });
      if (!contact.success) return invalid(contact.error);
      // Marking a contact primary un-marks the others in the database (trigger one_primary_contact).
      const { data, error } = cur
        ? await db.from("client_contacts").update(contact.data).eq("id", cur.id).eq("client_id", client_id).select("id")
        : await db.from("client_contacts").insert({ ...contact.data, client_id, organization_id: client.organization_id }).select("id");
      if (error) return fail(dbErrorMessage(error));
      if (!data.length) return fail("You can't edit client contacts.");
      return ok({ saved: true, contact_id: data[0].id, url: `/clients/${client_id}` });
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

  // ───────────── Blog (PRD §49): drafts only; publishing and cover images stay in the app ─────────────

  server.registerTool(
    "list_blog_categories",
    { title: "List blog categories", description: "Blog categories (ids for posts) with post counts.", inputSchema: z.object({}), annotations: READ },
    run(async (_args, db) => ok(await listCategories(db))),
  );

  server.registerTool(
    "create_blog_category",
    {
      title: "Create blog category",
      description: "Adds a blog category, e.g. Tech News. Check list_blog_categories first so you don't add a near-duplicate.",
      inputSchema: z.object({
        name: z.string(),
        slug: z.string().optional().describe("lowercase-with-dashes; made from the name when left out"),
        description: z.string().optional(),
      }),
      annotations: WRITE,
    },
    run(async (args, db) => {
      const parsed = categorySchema.safeParse({ slug: "", description: "", ...args });
      if (!parsed.success) return invalid(parsed.error);
      const { data: org } = await db.rpc("current_org_id");
      if (!org) return fail("You don't have permission to do this.");
      const { data, error } = await db.from("blog_categories").insert({ ...parsed.data, organization_id: org }).select("id, name, slug").single();
      if (error) return fail(error.code === "23505" ? "A category with this slug already exists." : dbErrorMessage(error));
      return ok(data);
    }),
  );

  server.registerTool(
    "list_blog_posts",
    {
      title: "List blog posts",
      description: "Blog posts, most recently updated first (no content; use get_blog_post).",
      inputSchema: z.object({
        search: z.string().optional().describe("Title"),
        status: z.enum(POST_STATUSES.map((s) => s.value)).optional(),
        category_id: z.uuid().optional(),
        page: z.number().int().min(1).optional(),
      }),
      annotations: READ,
    },
    run(async ({ search, status, category_id, page }, db) => ok(await listPosts({ q: search ?? "", page: page ?? 1, status, category: category_id }, db))),
  );

  server.registerTool(
    "get_blog_post",
    { title: "Get blog post", description: "One blog post with its HTML content and SEO fields.", inputSchema: z.object({ id: z.uuid() }), annotations: READ },
    run(async ({ id }, db) => {
      const post = await getPost(id, db);
      return post ? ok(post) : fail("Post not found.");
    }),
  );

  server.registerTool(
    "create_blog_post",
    {
      title: "Create blog post",
      description:
        "Saves a draft blog post for the company website. A person reviews, adds the cover image and publishes it in the app. " +
        "For news about a new release, read the official release notes or announcement first and link them; summarise in your own words with what it means for clients, never copy text.",
      inputSchema: z.object(postFields),
      annotations: WRITE,
    },
    run(async (args, db) => {
      const parsed = postSchema.safeParse({ ...EMPTY_POST, ...args } satisfies PostInput);
      if (!parsed.success) return invalid(parsed.error);
      const { data: org } = await db.rpc("current_org_id");
      if (!org) return fail("You don't have permission to do this.");
      const { data, error } = await db.from("blog_posts").insert({ ...parsed.data, organization_id: org }).select("id, slug, status").single();
      if (error) return fail(error.code === "23505" ? "Another post already uses this slug; pass a different slug." : dbErrorMessage(error));
      return ok({ ...data, url: `/blog/posts/${data.id}` });
    }),
  );

  server.registerTool(
    "update_blog_post",
    {
      title: "Update draft blog post",
      description: "Changes the given fields of a draft post; others stay as they are. content, when given, replaces the whole body. Published posts are changed in the app.",
      inputSchema: z.object({ id: z.uuid(), ...postFields, title: postFields.title.optional(), category_id: postFields.category_id.optional(), content: postFields.content.optional() }),
      annotations: WRITE,
    },
    run(async ({ id, ...changes }, db) => {
      const post = await getPost(id, db);
      if (!post) return fail("Post not found.");
      if (post.status !== "draft") return fail("Only draft posts can be edited through Claude. Unpublish it in the app first.");
      const strip = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
      const parsed = postSchema.safeParse({
        title: post.title, slug: post.slug, category_id: post.category_id, excerpt: post.excerpt, content: post.content,
        seo_title: post.seo_title, meta_description: post.meta_description, canonical_url: post.canonical_url, ...strip,
      } satisfies PostInput);
      if (!parsed.success) return invalid(parsed.error);
      const { data, error } = await db.from("blog_posts").update(parsed.data).eq("id", id).eq("status", "draft").select("id, slug, status");
      if (error) return fail(error.code === "23505" ? "Another post already uses this slug." : dbErrorMessage(error));
      return data.length ? ok({ ...data[0], url: `/blog/posts/${id}` }) : fail("This post is no longer a draft, or you can't edit posts.");
    }),
  );
}
