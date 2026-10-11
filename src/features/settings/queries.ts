import { createClient } from "@/lib/supabase/server";

export async function getCompanySettings() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("company_settings").select("*").maybeSingle();
  if (error) throw error;
  return data;
}

export async function getTaxRates() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tax_rates").select("id, name, rate, is_active").order("rate");
  if (error) throw error;
  return data;
}

export async function getExpenseCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("expense_categories").select("id, name, is_active").order("name");
  if (error) throw error;
  return data;
}

export async function getDocumentNumbering() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("document_numbering_settings");
  if (error) throw error;
  return data;
}

/** Short-lived signed URLs for previewing the logo and signature (private `branding` bucket). */
export async function getBrandingUrls(settings: { logo_path: string | null; signature_path: string | null }) {
  const supabase = await createClient();
  const sign = async (path: string | null) =>
    path ? ((await supabase.storage.from("branding").createSignedUrl(path, 3600)).data?.signedUrl ?? null) : null;
  const [logo, signature] = await Promise.all([sign(settings.logo_path), sign(settings.signature_path)]);
  return { logo, signature };
}

/** Latest nightly backup run (PRD §34); null when none is visible (no settings.view, or never ran). */
export async function getLastBackup() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("backup_runs")
    .select("status, finished_at, size_bytes, files, run_url")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data && { ...data, ageHours: (Date.now() - Date.parse(data.finished_at)) / 3_600_000 };
}
