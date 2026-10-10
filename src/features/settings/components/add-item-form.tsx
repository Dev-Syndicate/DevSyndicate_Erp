"use client";

import { useActionState, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { addExpenseCategory, addTaxRate } from "@/features/settings/actions";
import type { FormState } from "@/features/settings/schema";

const forms = {
  tax_rates: { action: addTaxRate, placeholder: "e.g. GST 12%", withRate: true },
  expense_categories: { action: addExpenseCategory, placeholder: "e.g. Utilities", withRate: false },
};

export function AddItemForm({ kind }: { kind: keyof typeof forms }) {
  const { action: add, placeholder, withRate } = forms[kind];
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await add(prev, formData);
    if (result.ok) formRef.current?.reset();
    if (result.error) toast.error(result.error);
    return result;
  }, {});
  const err = state.fieldErrors ?? {};

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-start gap-3">
      <Field data-invalid={!!err.name} className="w-56">
        <FieldLabel htmlFor={`${kind}-name`} className="sr-only">Name</FieldLabel>
        <Input id={`${kind}-name`} name="name" placeholder={placeholder} required aria-invalid={!!err.name} />
        <FieldError>{err.name}</FieldError>
      </Field>
      {withRate && (
        <Field data-invalid={!!err.rate} className="w-32">
          <FieldLabel htmlFor="rate" className="sr-only">Rate (%)</FieldLabel>
          <Input id="rate" name="rate" type="number" step="0.01" min="0" max="100" placeholder="Rate %" required aria-invalid={!!err.rate} />
          <FieldError>{err.rate}</FieldError>
        </Field>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </Button>
    </form>
  );
}
