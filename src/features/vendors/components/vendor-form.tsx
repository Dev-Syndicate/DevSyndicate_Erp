"use client";

import { useActionState, type ComponentProps } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveVendor } from "@/features/vendors/actions";
import type { FormState } from "@/lib/forms";
import type { Tables } from "@/lib/supabase/database.types";

type Props = {
  vendor?: Tables<"vendors">;
  categories: { id: string; name: string }[];
  readOnly?: boolean;
};

export function VendorForm({ vendor, categories, readOnly = false }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveVendor.bind(null, vendor?.id ?? null), {});
  const err = state.fieldErrors ?? {};

  const text = (name: keyof Tables<"vendors"> & string, label: string, props: ComponentProps<typeof Input> = {}) => (
    <Field data-invalid={!!err[name]}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input id={name} name={name} defaultValue={String(vendor?.[name] ?? "")} aria-invalid={!!err[name]} {...props} />
      <FieldError>{err[name]}</FieldError>
    </Field>
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      <Card>
        <CardContent>
          <fieldset disabled={readOnly || pending} className="contents">
            <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="col-span-full">{text("name", "Vendor name", { required: true })}</div>
              {text("contact_person", "Contact person")}
              {text("email", "Email", { type: "email" })}
              {text("phone", "Phone", { type: "tel" })}
              {text("gstin", "GSTIN", { maxLength: 15, className: "uppercase" })}
              <Field>
                <FieldLabel htmlFor="default_expense_category_id">Default expense category</FieldLabel>
                <Select name="default_expense_category_id" defaultValue={vendor?.default_expense_category_id ?? undefined}>
                  <SelectTrigger id="default_expense_category_id" className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="col-span-full">
                <Field>
                  <FieldLabel htmlFor="address">Address</FieldLabel>
                  <Textarea id="address" name="address" defaultValue={vendor?.address} rows={2} />
                </Field>
              </div>
              <div className="col-span-full">
                <Field>
                  <FieldLabel htmlFor="notes">Notes</FieldLabel>
                  <Textarea id="notes" name="notes" defaultValue={vendor?.notes} rows={3} />
                </Field>
              </div>
            </FieldGroup>
          </fieldset>
        </CardContent>
      </Card>

      {state.error && <FieldError>{state.error}</FieldError>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/vendors">{readOnly ? "Back" : "Cancel"}</Link>
        </Button>
        {!readOnly && (
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : vendor ? "Save changes" : "Create vendor"}
          </Button>
        )}
      </div>
    </form>
  );
}
