import { websiteEnquirySchema } from "@/features/leads/schema";
import { fieldErrors } from "@/lib/forms";
import { createAnonClient } from "@/lib/supabase/anon";

// Website contact form → a Website lead (PRD §47). Called by the website's server with the form key from
// Settings → Company; the database checks the key, ignores double submits and caps enquiries per hour.
export async function POST(request: Request) {
  const key = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!key) return Response.json({ error: "Missing form key" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = websiteEnquirySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid enquiry", fields: fieldErrors(parsed.error) }, { status: 400 });

  const { name, email, company, need, message } = parsed.data;
  const { error } = await createAnonClient().rpc("submit_website_lead", {
    p_key: key, p_name: name, p_email: email, p_company: company, p_need: need, p_message: message,
  });
  if (!error) return Response.json({ ok: true }, { status: 201 });
  if (error.code === "42501") return Response.json({ error: "Invalid form key" }, { status: 401 });
  if (error.code === "54000") return Response.json({ error: "Too many enquiries, try again later" }, { status: 429 });
  if (error.code === "22023" || error.code === "23514") return Response.json({ error: "Invalid enquiry" }, { status: 400 });
  console.error("website lead", error);
  return Response.json({ error: "Could not save the enquiry" }, { status: 500 });
}
