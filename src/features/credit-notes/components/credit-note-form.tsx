"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  blankLine,
  issuesByPath,
  LineItemsCard,
  linesFrom,
  SummaryCard,
  useDocumentTotals,
  type FormSettings,
  type LineItem,
  type TaxRate,
} from "@/components/document-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/date-picker";
import { saveCreditNote } from "@/features/credit-notes/actions";
import { creditNoteSchema, type CreditNoteInput } from "@/features/credit-notes/schema";
import { formatDate, istToday } from "@/lib/dates";
import { formatINR, paise, type DiscountType, type SupplyType } from "@/lib/money";
import type { Tables } from "@/lib/supabase/database.types";

type Invoice = {
  id: string;
  number: string | null;
  invoice_date: string;
  grand_total: number;
  amount_credited: number | null;
  supply_type: string;
  gst_applicable: boolean;
  place_of_supply: string;
  clients: { company_name: string } | null;
  invoice_items: { tax_rate: number; sac_code: string }[];
};

type Props = {
  invoice: Invoice;
  taxRates: TaxRate[];
  settings: FormSettings;
  creditNote?: Tables<"credit_notes"> & { credit_note_items: Tables<"credit_note_items">[] };
};

export function CreditNoteForm({ invoice, taxRates, settings, creditNote }: Props) {
  const supplyType = invoice.supply_type as SupplyType;
  // Tax follows the invoice (PRD §18): its GST status and supply, not today's settings.
  const docSettings: FormSettings = settings && { ...settings, gst_registered: invoice.gst_applicable };
  const showTax = invoice.gst_applicable && supplyType !== "export";
  const first = invoice.invoice_items[0];
  const newLine = (): LineItem => ({ ...blankLine(docSettings), tax_rate: String(first?.tax_rate ?? 0), sac_code: first?.sac_code ?? "" });

  const [form, setForm] = useState<Omit<CreditNoteInput, "items">>(() => ({
    invoice_id: invoice.id,
    credit_note_date: creditNote?.credit_note_date ?? istToday(),
    reason: creditNote?.reason ?? "",
    discount_type: (creditNote?.discount_type as DiscountType) ?? "amount",
    discount_value: String(creditNote?.discount_value ?? 0),
    notes: creditNote?.notes ?? "",
  }));
  const [items, setItems] = useState<LineItem[]>(() =>
    creditNote?.credit_note_items.length ? linesFrom(creditNote.credit_note_items) : [newLine()],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const totals = useDocumentTotals(items, form, supplyType, docSettings);
  // A draft being edited isn't counted in amount_credited (only issued notes are).
  const left = paise(invoice.grand_total) - paise(invoice.amount_credited ?? 0);

  const set = <K extends keyof typeof form>(name: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [name]: value }));
  const err = (path: string) => errors[path];

  function submit() {
    const input: CreditNoteInput = { ...form, items };
    const parsed = creditNoteSchema.safeParse(input);
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
      const result = await saveCreditNote(creditNote?.id ?? null, input);
      if (result?.error) toast.error(result.error);
    });
  }

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
            <CardDescription>
              Against {invoice.number} of {formatDate(invoice.invoice_date)} for {invoice.clients?.company_name} ·{" "}
              {formatINR(invoice.grand_total)} invoiced, {formatINR(left)} left to credit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field>
                <FieldLabel htmlFor="credit_note_date">Credit note date</FieldLabel>
                <DatePicker id="credit_note_date" value={form.credit_note_date} min={invoice.invoice_date} onChange={(v) => set("credit_note_date", v)} />
              </Field>
              <Field data-invalid={!!err("reason")} className="sm:col-span-2 lg:col-span-3">
                <FieldLabel htmlFor="reason">Reason</FieldLabel>
                <Input id="reason" value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="e.g. Discount agreed after delivery" aria-invalid={!!err("reason")} />
                <FieldError>{err("reason")}</FieldError>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <LineItemsCard
          items={items}
          setItems={setItems}
          newLine={newLine}
          totals={totals}
          showTax={showTax}
          showSac={settings?.show_sac ?? false}
          showDiscount={false}
          taxRates={taxRates}
          errors={errors}
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Field>
                <Textarea id="notes" aria-label="Notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={5} />
                <FieldDescription>Printed on the credit note.</FieldDescription>
              </Field>
            </CardContent>
          </Card>
          <SummaryCard
            totals={totals}
            supplyType={supplyType}
            showTax={showTax}
          />
        </div>

        {totals.grandTotal > left && (
          <p className="text-sm text-destructive">This is more than the {formatINR(left)} left to credit on the invoice; it can be saved but not issued.</p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" asChild>
            <Link href={creditNote ? `/finance/credit-notes/${creditNote.id}` : `/finance/invoices/${invoice.id}`}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : creditNote ? "Save draft" : "Create draft"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
