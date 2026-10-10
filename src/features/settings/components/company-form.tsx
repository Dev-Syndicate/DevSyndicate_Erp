"use client";

import { useActionState, type ComponentProps } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { updateCompanySettings } from "@/features/settings/actions";
import { NumberingCard } from "@/features/settings/components/numbering-card";
import type { FormState } from "@/lib/forms";
import { INDIAN_STATES } from "@/lib/india";
import type { Tables } from "@/lib/supabase/database.types";

type Props = {
  settings: Tables<"company_settings">;
  taxRates: { id: string; name: string }[];
  numbering: { doc_type: string; pattern: string; padding: number; reset: string; next_value: number }[];
  canEdit: boolean;
};

export function CompanyForm({ settings: s, taxRates, numbering, canEdit }: Props) {
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
    <Field orientation="horizontal" className="rounded-lg border p-4">
      <FieldContent>
        <FieldLabel htmlFor={name}>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
      <Switch id={name} name={name} defaultChecked={s[name]} />
    </Field>
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      <FieldSet disabled={!canEdit || pending} className="contents">
        <Card>
          <CardHeader>
            <CardTitle>Company</CardTitle>
            <CardDescription>Printed on quotations and invoices.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {text("legal_name", "Legal name", { required: true })}
              {text("trade_name", "Trade name")}
              <div className="col-span-full">
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
            <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="col-span-full">
                {toggle("gst_registered", "GST registered", "Issue tax invoices with GSTIN, SAC codes and CGST/SGST/IGST.")}
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
            <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {text("bank_name", "Bank name")}
              {text("bank_account_name", "Account name")}
              {text("bank_account_number", "Account number", { inputMode: "numeric" })}
              {text("bank_ifsc", "IFSC", { maxLength: 11, className: "uppercase" })}
              {text("upi_id", "UPI ID", { placeholder: "name@bank" })}
            </FieldGroup>
          </CardContent>
        </Card>

        <NumberingCard rows={numbering} errors={err} />

        <Card>
          <CardHeader>
            <CardTitle>Defaults</CardTitle>
            <CardDescription>Pre-filled on new documents; you can change them per document.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["quotation_validity_days", "Quotation validity", 1, "How long a quotation stays open."],
                  ["payment_terms_days", "Payment terms", 0, "Due date is the invoice date plus these days."],
                ] as const
              ).map(([name, label, min, description]) => (
                <Field key={name} data-invalid={!!err[name]}>
                  <FieldLabel htmlFor={name}>{label}</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id={name}
                      name={name}
                      type="number"
                      min={min}
                      max={365}
                      defaultValue={s[name]}
                      aria-invalid={!!err[name]}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>days</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldDescription>{description}</FieldDescription>
                  <FieldError>{err[name]}</FieldError>
                </Field>
              ))}
              <div className="col-span-full">
                {toggle("round_off", "Round off totals", "Round grand totals to the nearest ₹1 and show the difference as a round-off line.")}
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Terms & signature</CardTitle>
            <CardDescription>Printed at the bottom of quotations and invoices.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="quotation_terms">Quotation terms</FieldLabel>
                <Textarea id="quotation_terms" name="quotation_terms" defaultValue={s.quotation_terms} rows={6} />
              </Field>
              <Field>
                <FieldLabel htmlFor="invoice_terms">Invoice terms</FieldLabel>
                <Textarea id="invoice_terms" name="invoice_terms" defaultValue={s.invoice_terms} rows={6} />
              </Field>
              <Field data-invalid={!!err.signatory_name}>
                <FieldLabel htmlFor="signatory_name">Authorised signatory</FieldLabel>
                <Input
                  id="signatory_name"
                  name="signatory_name"
                  defaultValue={s.signatory_name}
                  aria-invalid={!!err.signatory_name}
                />
                <FieldDescription>Name printed under the signature line.</FieldDescription>
                <FieldError>{err.signatory_name}</FieldError>
              </Field>
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
