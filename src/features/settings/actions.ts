"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  companySettingsSchema,
  expenseCategorySchema,
  fieldErrors,
  taxRateSchema,
  type FormState,
} from "./schema";

const NO_PERMISSION = "You don't have permission to change settings.";

export async function updateCompanySettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = companySettingsSchema.safeParse({
    ...Object.fromEntries(formData),
    gst_registered: formData.get("gst_registered") === "on",
    round_off: formData.get("round_off") === "on",
  });
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  const { supabase, organizationId } = await orgId();
  if (!organizationId) return { error: NO_PERMISSION };
  // RLS also requires settings.update; zero updated rows means no permission.
  const { data, error } = await supabase
    .from("company_settings")
    .update(parsed.data)
    .eq("organization_id", organizationId)
    .select("organization_id");
  if (error) return { error: error.message };
  if (!data.length) return { error: NO_PERMISSION };

  revalidatePath("/settings/company");
  return { ok: true };
}

async function orgId() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("current_org_id");
  return { supabase, organizationId: data };
}

export async function addTaxRate(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = taxRateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const { supabase, organizationId } = await orgId();
  if (!organizationId) return { error: NO_PERMISSION };
  const { error } = await supabase.from("tax_rates").insert({ ...parsed.data, organization_id: organizationId });
  if (error) return { error: error.code === "23505" ? "A tax rate with this name exists." : NO_PERMISSION };

  revalidatePath("/settings/tax-rates");
  return { ok: true };
}

export async function addExpenseCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = expenseCategorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const { supabase, organizationId } = await orgId();
  if (!organizationId) return { error: NO_PERMISSION };
  const { error } = await supabase.from("expense_categories").insert({ ...parsed.data, organization_id: organizationId });
  if (error) return { error: error.code === "23505" ? "This category exists." : NO_PERMISSION };

  revalidatePath("/settings/expense-categories");
  return { ok: true };
}

/** Archive or restore; rows are never deleted (PRD §22). */
export async function setActive(table: "tax_rates" | "expense_categories", id: string, isActive: boolean) {
  // Server actions are public endpoints: re-check arguments at runtime.
  if (table !== "tax_rates" && table !== "expense_categories") return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase.from(table).update({ is_active: isActive }).eq("id", id).select("id");
  if (error || !data.length) return { error: NO_PERMISSION };

  revalidatePath(table === "tax_rates" ? "/settings/tax-rates" : "/settings/expense-categories");
  return { ok: true };
}
