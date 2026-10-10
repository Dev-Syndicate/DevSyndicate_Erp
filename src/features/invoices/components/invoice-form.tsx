"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  blankLine,
  ClientContactFields,
  defaultContactId,
  issuesByPath,
  LineItemsCard,
  linesFrom,
  PlaceOfSupplyField,
  SummaryCard,
  supplyTypeFor,
  useDocumentTotals,
  type FormClient,
  type FormSettings,
  type LineItem,
  type TaxRate,
} from "@/components/document-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveInvoice } from "@/features/invoices/actions";
import { invoiceSchema, type InvoiceInput } from "@/features/invoices/schema";
import { addDays, istToday } from "@/lib/dates";
import type { DiscountType } from "@/lib/money";
import type { Tables } from "@/lib/supabase/database.types";

type Props = {
  clients: FormClient[];
  taxRates: TaxRate[];
  settings: (FormSettings & { payment_terms_days: number; invoice_terms: string }) | null;
  invoice?: Tables<"invoices"> & { invoice_items: Tables<"invoice_items">[] };
};

export function InvoiceForm({ clients, taxRates, settings, invoice }: Props) {
  const today = istToday();
  const gst = settings?.gst_registered ?? false;
  /** Client payment terms, else the company default (PRD §15). */
  const termsDays = (c: FormClient | undefined) => c?.payment_terms_days ?? settings?.payment_terms_days ?? 15;

  const [form, setForm] = useState<Omit<InvoiceInput, "items">>(() => ({
    client_id: invoice?.client_id ?? "",
    contact_id: invoice?.contact_id ?? "",
    invoice_date: invoice?.invoice_date ?? today,
    due_date: invoice?.due_date ?? addDays(today, termsDays(undefined)),
    place_of_supply: invoice?.place_of_supply ?? "",
    discount_type: (invoice?.discount_type as DiscountType) ?? "amount",
    discount_value: String(invoice?.discount_value ?? 0),
    terms: invoice?.terms ?? settings?.invoice_terms ?? "",
    notes: invoice?.notes ?? "",
  }));
  const [items, setItems] = useState<LineItem[]>(() =>
    invoice?.invoice_items.length ? linesFrom(invoice.invoice_items) : [blankLine(settings)],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const client = clients.find((c) => c.id === form.client_id);
  const placeOfSupply = form.place_of_supply || client?.state || "";
  const supplyType = supplyTypeFor(client, placeOfSupply, settings);
  const showTax = gst && supplyType !== "export";
  const totals = useDocumentTotals(items, form, supplyType, settings);

  const set = <K extends keyof typeof form>(name: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [name]: value }));

  function submit() {
    const input: InvoiceInput = { ...form, items }; // the schema strips the client-only `key`
    const parsed = invoiceSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(issuesByPath(parsed.error.issues));
      toast.error("Please fix the highlighted fields.");
      return;
    }
    if (totals.error) {
      toast.error(totals.error);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await saveInvoice(invoice?.id ?? null, input);
      if (result?.error) toast.error(result.error);
    });
  }

  const err = (path: string) => errors[path];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-6"
    >
      <fieldset disabled={pending} className="contents">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ClientContactFields
                clients={clients}
                clientId={form.client_id}
                contactId={form.contact_id}
                error={err("client_id")}
                onClientChange={(c) =>
                  setForm((f) => ({
                    ...f,
                    client_id: c.id,
                    contact_id: defaultContactId(c),
                    place_of_supply: "",
                    due_date: addDays(f.invoice_date, termsDays(c)),
                  }))
                }
                onContactChange={(v) => set("contact_id", v)}
              />
              <Field>
                <FieldLabel htmlFor="invoice_date">Invoice date</FieldLabel>
                <Input
                  id="invoice_date"
                  type="date"
                  value={form.invoice_date}
                  onChange={(e) => setForm((f) => ({ ...f, invoice_date: e.target.value, due_date: e.target.value ? addDays(e.target.value, termsDays(client)) : f.due_date }))}
                />
              </Field>
              <Field data-invalid={!!err("due_date")}>
                <FieldLabel htmlFor="due_date">Due date</FieldLabel>
                <Input id="due_date" type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} aria-invalid={!!err("due_date")} />
                <FieldError>{err("due_date")}</FieldError>
              </Field>
              <PlaceOfSupplyField client={client} value={placeOfSupply} supplyType={supplyType} gst={gst} onChange={(v) => set("place_of_supply", v)} />
            </FieldGroup>
          </CardContent>
        </Card>

        <LineItemsCard items={items} setItems={setItems} newLine={() => blankLine(settings)} totals={totals} showTax={showTax} taxRates={taxRates} errors={errors} />

        <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
          <Card>
            <CardHeader>
              <CardTitle>Terms & notes</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="terms">Terms</FieldLabel>
                  <Textarea id="terms" value={form.terms} onChange={(e) => set("terms", e.target.value)} rows={6} />
                  <FieldDescription>Pre-filled from company settings.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="notes">Notes</FieldLabel>
                  <Textarea id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={6} />
                  <FieldDescription>Printed on the invoice.</FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <SummaryCard
            totals={totals}
            supplyType={supplyType}
            showTax={showTax}
            discountType={form.discount_type}
            discountValue={form.discount_value}
            discountError={err("discount_value")}
            onDiscountValue={(v) => set("discount_value", v)}
            onDiscountType={(t) => set("discount_type", t)}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" asChild>
            <Link href={invoice ? `/finance/invoices/${invoice.id}` : "/finance/invoices"}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : invoice ? "Save draft" : "Create draft"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
