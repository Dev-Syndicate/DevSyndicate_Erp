"use client";

import { useActionState, type ComponentProps } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { updateCompanySettings } from "@/features/settings/actions";
import type { FormState } from "@/features/settings/schema";
import { INDIAN_STATES } from "@/lib/india";
import type { Tables } from "@/lib/supabase/database.types";

type Props = {
  settings: Tables<"company_settings">;
  taxRates: { id: string; name: string }[];
  canEdit: boolean;
};

export function CompanyForm({ settings: s, taxRates, canEdit }: Props) {
  const [state, action, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await updateCompanySettings(prev, formData);
    if (result.ok) toast.success("Company settings saved");
    else if (result.error) toast.error(result.error);
    return result;
  }, {});
  const err = state.fieldErrors ?? {};

  const text = (name: keyof typeof s & string, label: string, props: ComponentProps<typeof Input> = {}) => (
    <Field data-invalid={!!err[name]}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input id={name} name={name} defaultValue={String(s[name] ?? "")} aria-invalid={!!err[name]} {...props} />
      <FieldError>{err[name]}</FieldError>
    </Field>
  );

  const toggle = (name: "gst_registered" | "round_off", label: string, description: string) => (
    <Field orientation="horizontal">
      <Switch id={name} name={name} defaultChecked={s[name]} />
      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor={name}>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </div>
    </Field>
  );

  return (
    <form action={action} className="flex max-w-3xl flex-col gap-6">
      <FieldSet disabled={!canEdit || pending} className="contents">
        <Card>
          <CardHeader>
            <CardTitle>Company</CardTitle>
            <CardDescription>Printed on quotations and invoices.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              {text("legal_name", "Legal name", { required: true })}
              {text("trade_name", "Trade name")}
              <div className="sm:col-span-2">
                <Field data-invalid={!!err.address}>
                  <FieldLabel htmlFor="address">Address</FieldLabel>
                  <Textarea id="address" name="address" defaultValue={s.address} rows={2} />
                  <FieldError>{err.address}</FieldError>
                </Field>
              </div>
              {text("city", "City")}
              <Field data-invalid={!!err.state}>
                <FieldLabel htmlFor="state">State</FieldLabel>
                <Select name="state" defaultValue={s.state || undefined}>
                  <SelectTrigger id="state" className="w-full">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map((st) => (
                      <SelectItem key={st.code} value={st.name}>
                        {st.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError>{err.state}</FieldError>
              </Field>
              {text("pin_code", "PIN code", { inputMode: "numeric", maxLength: 6 })}
              {text("pan", "PAN", { maxLength: 10, className: "uppercase" })}
              {text("email", "Email", { type: "email" })}
              {text("phone", "Phone", { type: "tel" })}
              {text("website", "Website")}
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tax</CardTitle>
            <CardDescription>GST details switch on tax fields across quotations and invoices.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                {toggle("gst_registered", "GST registered", "Issue tax invoices with CGST/SGST/IGST.")}
              </div>
              {text("gstin", "GSTIN", { maxLength: 15, className: "uppercase" })}
              {text("default_sac_code", "Default SAC code", { inputMode: "numeric" })}
              <Field data-invalid={!!err.default_tax_rate_id}>
                <FieldLabel htmlFor="default_tax_rate_id">Default tax rate</FieldLabel>
                <Select name="default_tax_rate_id" defaultValue={s.default_tax_rate_id ?? undefined}>
                  <SelectTrigger id="default_tax_rate_id" className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    {taxRates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div />
              {text("lut_number", "LUT number", { placeholder: "For export invoices" })}
              {text("lut_valid_until", "LUT valid until", { type: "date" })}
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Banking</CardTitle>
            <CardDescription>Payment details printed on invoices.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              {text("bank_name", "Bank name")}
              {text("bank_account_name", "Account name")}
              {text("bank_account_number", "Account number", { inputMode: "numeric" })}
              {text("bank_ifsc", "IFSC", { maxLength: 11, className: "uppercase" })}
              {text("upi_id", "UPI ID", { placeholder: "name@bank" })}
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>Numbering prefixes, defaults and terms.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-5">
              {text("prefix_quotation", "Quotation", { maxLength: 5, className: "uppercase" })}
              {text("prefix_invoice", "Invoice", { maxLength: 5, className: "uppercase" })}
              {text("prefix_credit_note", "Credit note", { maxLength: 5, className: "uppercase" })}
              {text("prefix_receipt", "Receipt", { maxLength: 5, className: "uppercase" })}
              {text("prefix_expense", "Expense", { maxLength: 5, className: "uppercase" })}
            </FieldGroup>
            <FieldGroup className="mt-4 grid gap-4 sm:grid-cols-2">
              {text("quotation_validity_days", "Quotation validity (days)", { type: "number", min: 1, max: 365 })}
              {text("payment_terms_days", "Payment terms (days)", { type: "number", min: 0, max: 365 })}
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="quotation_terms">Default quotation terms</FieldLabel>
                <Textarea id="quotation_terms" name="quotation_terms" defaultValue={s.quotation_terms} rows={3} />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="invoice_terms">Default invoice terms</FieldLabel>
                <Textarea id="invoice_terms" name="invoice_terms" defaultValue={s.invoice_terms} rows={3} />
              </Field>
              {text("signatory_name", "Authorised signatory")}
              <div className="self-end">{toggle("round_off", "Round off totals", "Round grand totals to the nearest ₹1.")}</div>
            </FieldGroup>
          </CardContent>
        </Card>
      </FieldSet>

      {canEdit && (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </form>
  );
}
