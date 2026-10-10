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
import { saveQuotation } from "@/features/quotations/actions";
import { quotationSchema, type QuotationInput } from "@/features/quotations/schema";
import { addDays, istToday } from "@/lib/dates";
import type { DiscountType } from "@/lib/money";
import type { Tables } from "@/lib/supabase/database.types";

type Props = {
  clients: FormClient[];
  taxRates: TaxRate[];
  settings: (FormSettings & { quotation_validity_days: number; quotation_terms: string }) | null;
  quotation?: Tables<"quotations"> & { quotation_items: Tables<"quotation_items">[] };
};

export function QuotationForm({ clients, taxRates, settings, quotation }: Props) {
  const today = istToday();
  const gst = settings?.gst_registered ?? false;

  const [form, setForm] = useState<Omit<QuotationInput, "items">>(() => ({
    client_id: quotation?.client_id ?? "",
    contact_id: quotation?.contact_id ?? "",
    quotation_date: quotation?.quotation_date ?? today,
    valid_until: quotation?.valid_until ?? addDays(today, settings?.quotation_validity_days ?? 15),
    title: quotation?.title ?? "",
    description: quotation?.description ?? "",
    place_of_supply: quotation?.place_of_supply ?? "",
    discount_type: (quotation?.discount_type as DiscountType) ?? "amount",
    discount_value: String(quotation?.discount_value ?? 0),
    terms: quotation?.terms ?? settings?.quotation_terms ?? "",
    notes: quotation?.notes ?? "",
  }));
  const [items, setItems] = useState<LineItem[]>(() =>
    quotation?.quotation_items.length ? linesFrom(quotation.quotation_items) : [blankLine(settings)],
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
    const input: QuotationInput = { ...form, items }; // the schema strips the client-only `key`
    const parsed = quotationSchema.safeParse(input);
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
      const result = await saveQuotation(quotation?.id ?? null, input);
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
                onClientChange={(c) => setForm((f) => ({ ...f, client_id: c.id, contact_id: defaultContactId(c), place_of_supply: "" }))}
                onContactChange={(v) => set("contact_id", v)}
              />
              <Field data-invalid={!!err("title")} className="sm:col-span-2 lg:col-span-4">
                <FieldLabel htmlFor="title">Title</FieldLabel>
                <Input id="title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Website redesign" aria-invalid={!!err("title")} />
                <FieldError>{err("title")}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="quotation_date">Quotation date</FieldLabel>
                <Input id="quotation_date" type="date" value={form.quotation_date} onChange={(e) => set("quotation_date", e.target.value)} />
              </Field>
              <Field data-invalid={!!err("valid_until")}>
                <FieldLabel htmlFor="valid_until">Valid until</FieldLabel>
                <Input id="valid_until" type="date" value={form.valid_until} onChange={(e) => set("valid_until", e.target.value)} aria-invalid={!!err("valid_until")} />
                <FieldError>{err("valid_until")}</FieldError>
              </Field>
              <PlaceOfSupplyField client={client} value={placeOfSupply} supplyType={supplyType} gst={gst} onChange={(v) => set("place_of_supply", v)} />
              <Field className="sm:col-span-2 lg:col-span-4">
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Textarea id="description" value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="Scope summary shown under the title" />
              </Field>
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
                  <FieldLabel htmlFor="terms">Terms & conditions</FieldLabel>
                  <Textarea id="terms" value={form.terms} onChange={(e) => set("terms", e.target.value)} rows={6} />
                  <FieldDescription>Pre-filled from company settings.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="notes">Notes</FieldLabel>
                  <Textarea id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={6} />
                  <FieldDescription>Printed on the quotation.</FieldDescription>
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
            <Link href={quotation ? `/finance/quotations/${quotation.id}` : "/finance/quotations"}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : quotation ? "Save draft" : "Create draft"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
