"use client";

import { useActionState, useState, type ComponentProps } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClientRecord, updateClientRecord } from "@/features/clients/actions";
import type { FormState } from "@/lib/forms";
import { INDIAN_STATES } from "@/lib/india";
import type { Tables } from "@/lib/supabase/database.types";

type Props = { client?: Tables<"clients"> };

export function ClientForm({ client }: Props) {
  const save = client ? updateClientRecord.bind(null, client.id) : createClientRecord;
  const [state, action, pending] = useActionState<FormState, FormData>(save, {});
  const [country, setCountry] = useState(client?.country ?? "India");
  const err = state.fieldErrors ?? {};

  const text = (name: string, label: string, defaultValue = "", props: ComponentProps<typeof Input> = {}) => (
    <Field data-invalid={!!err[name]}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input id={name} name={name} defaultValue={defaultValue} aria-invalid={!!err[name]} {...props} />
      <FieldError>{err[name]}</FieldError>
    </Field>
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Company</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="col-span-full">{text("company_name", "Company name", client?.company_name, { required: true })}</div>
            <div className="col-span-full">
              <Field data-invalid={!!err.billing_address}>
                <FieldLabel htmlFor="billing_address">Billing address</FieldLabel>
                <Textarea id="billing_address" name="billing_address" defaultValue={client?.billing_address} rows={2} />
                <FieldError>{err.billing_address}</FieldError>
              </Field>
            </div>
            {text("city", "City", client?.city)}
            {text("country", "Country", country, { required: true, onChange: (e) => setCountry(e.target.value.trim()) })}
            {country === "India" ? (
              <Field data-invalid={!!err.state}>
                <FieldLabel htmlFor="state">State</FieldLabel>
                <Select name="state" defaultValue={client?.state || undefined}>
                  <SelectTrigger id="state" className="w-full" aria-invalid={!!err.state}>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map((s) => (
                      <SelectItem key={s.code} value={s.name}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError>{err.state}</FieldError>
              </Field>
            ) : (
              text("state", "State / region", client?.state)
            )}
            {text("pin_code", country === "India" ? "PIN code" : "Postal code", client?.pin_code)}
            {text("gstin", "GSTIN", client?.gstin, { maxLength: 15, className: "uppercase" })}
            {text("payment_terms_days", "Payment terms (days)", client?.payment_terms_days?.toString() ?? "", {
              type: "number",
              min: 0,
              max: 365,
              placeholder: "Company default",
            })}
            <div className="col-span-full">
              <Field>
                <FieldLabel htmlFor="notes">Notes</FieldLabel>
                <Textarea id="notes" name="notes" defaultValue={client?.notes} rows={3} />
              </Field>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      {!client && (
        <Card>
          <CardHeader>
            <CardTitle>Primary contact</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {text("contact_name", "Name")}
              {text("contact_designation", "Designation")}
              {text("contact_email", "Email", "", { type: "email" })}
              {text("contact_phone", "Phone", "", { type: "tel" })}
            </FieldGroup>
          </CardContent>
        </Card>
      )}

      {state.error && <FieldError>{state.error}</FieldError>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href={client ? `/clients/${client.id}` : "/clients"}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : client ? "Save changes" : "Create client"}
        </Button>
      </div>
    </form>
  );
}
