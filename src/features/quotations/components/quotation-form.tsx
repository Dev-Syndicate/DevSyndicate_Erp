"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { saveQuotation } from "@/features/quotations/actions";
import { quotationSchema, type QuotationInput } from "@/features/quotations/schema";
import { addDays, istToday } from "@/lib/dates";
import { INDIAN_STATES } from "@/lib/india";
import { calculateDocument, formatINR, type DiscountType, type SupplyType } from "@/lib/money";
import type { Tables } from "@/lib/supabase/database.types";

type Client = { id: string; company_name: string; state: string; country: string; client_contacts: { id: string; name: string; is_primary: boolean }[] };
type Settings = {
  state: string;
  gst_registered: boolean;
  round_off: boolean;
  default_sac_code: string;
  quotation_validity_days: number;
  quotation_terms: string;
  tax_rates: { rate: number } | null;
} | null;
type Item = QuotationInput["items"][number] & { key: string };

type Props = {
  clients: Client[];
  taxRates: { id: string; name: string; rate: number }[];
  settings: Settings;
  quotation?: Tables<"quotations"> & { quotation_items: Tables<"quotation_items">[] };
};

const key = () => crypto.randomUUID();

export function QuotationForm({ clients, taxRates, settings, quotation }: Props) {
  const today = istToday();
  const gst = settings?.gst_registered ?? false;
  const defaultRate = String(settings?.tax_rates?.rate ?? 0);
  const blankItem = (): Item => ({
    key: key(),
    description: "",
    sac_code: settings?.default_sac_code ?? "",
    quantity: "1",
    unit_price: "",
    discount_type: "amount",
    discount_value: "0",
    tax_rate: defaultRate,
  });

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
  const [items, setItems] = useState<Item[]>(() =>
    quotation?.quotation_items.length
      ? quotation.quotation_items.map((i) => ({
          key: i.id,
          description: i.description,
          sac_code: i.sac_code,
          quantity: String(i.quantity),
          unit_price: String(i.unit_price),
          discount_type: i.discount_type as DiscountType,
          discount_value: String(i.discount_value),
          tax_rate: String(i.tax_rate),
        }))
      : [blankItem()],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const client = clients.find((c) => c.id === form.client_id);
  const placeOfSupply = form.place_of_supply || client?.state || "";
  const supplyType: SupplyType = !client
    ? "intra"
    : client.country !== "India"
      ? "export"
      : placeOfSupply === settings?.state
        ? "intra"
        : "inter";
  const showTax = gst && supplyType !== "export";

  const totals = useMemo(
    () =>
      calculateDocument({
        lines: items.map((i) => ({
          quantity: i.quantity,
          unitPrice: i.unit_price || "0",
          discountType: i.discount_type,
          discountValue: i.discount_value,
          taxRate: i.tax_rate,
        })),
        discountType: form.discount_type,
        discountValue: form.discount_value,
        supplyType,
        gstApplicable: gst,
        roundOff: settings?.round_off ?? false,
      }),
    [items, form.discount_type, form.discount_value, supplyType, gst, settings?.round_off],
  );

  const set = <K extends keyof typeof form>(name: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [name]: value }));
  const setItem = (k: string, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.key === k ? { ...i, ...patch } : i)));

  function submit() {
    const input: QuotationInput = { ...form, items }; // the schema strips the client-only `key`
    const parsed = quotationSchema.safeParse(input);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[issue.path.join(".")] ??= issue.message;
      setErrors(next);
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
              <Field data-invalid={!!err("client_id")} className="lg:col-span-2">
                <FieldLabel htmlFor="client_id">Client</FieldLabel>
                <Select
                  value={form.client_id}
                  onValueChange={(v) => {
                    const c = clients.find((x) => x.id === v);
                    const primary = c?.client_contacts.find((x) => x.is_primary) ?? c?.client_contacts[0];
                    setForm((f) => ({ ...f, client_id: v, contact_id: primary?.id ?? "", place_of_supply: "" }));
                  }}
                >
                  <SelectTrigger id="client_id" className="w-full" aria-invalid={!!err("client_id")}>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {clients.length === 0 ? (
                  <FieldDescription>
                    No clients yet. <Link href="/clients/new" className="underline">Add a client</Link> first.
                  </FieldDescription>
                ) : (
                  <FieldError>{err("client_id")}</FieldError>
                )}
              </Field>
              <Field className="lg:col-span-2">
                <FieldLabel htmlFor="contact_id">Contact</FieldLabel>
                <Select value={form.contact_id || undefined} onValueChange={(v) => set("contact_id", v)} disabled={!client?.client_contacts.length}>
                  <SelectTrigger id="contact_id" className="w-full">
                    <SelectValue placeholder={client ? "No contact" : "Select a client first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {client?.client_contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
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
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="place_of_supply">Place of supply</FieldLabel>
                <Select value={placeOfSupply || undefined} onValueChange={(v) => set("place_of_supply", v)} disabled={client?.country !== "India"}>
                  <SelectTrigger id="place_of_supply" className="w-full">
                    <SelectValue placeholder={client && client.country !== "India" ? "Outside India (export)" : "Client's state"} />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map((s) => (
                      <SelectItem key={s.code} value={s.name}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {gst && client && (
                  <FieldDescription>
                    {supplyType === "intra" && "Same state as your company: CGST + SGST."}
                    {supplyType === "inter" && "Different state: IGST."}
                    {supplyType === "export" && "Export of services: zero-rated under LUT."}
                  </FieldDescription>
                )}
              </Field>
              <Field className="sm:col-span-2 lg:col-span-4">
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Textarea id="description" value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="Scope summary shown under the title" />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Line items</CardTitle>
            <CardDescription>Amounts are in ₹. Totals update as you type and are recalculated on save.</CardDescription>
            <CardAction>
              <Button type="button" variant="outline" onClick={() => setItems((l) => [...l, blankItem()])}>
                <Plus /> Add line
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <Table className="min-w-[56rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-24">SAC</TableHead>
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead className="w-32">Unit price</TableHead>
                  <TableHead className="w-44">Discount</TableHead>
                  {showTax && <TableHead className="w-32">Tax</TableHead>}
                  <TableHead className="w-32 text-right">Amount</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, i) => {
                  const e = (f: string) => err(`items.${i}.${f}`);
                  return (
                    <TableRow key={item.key} className="align-top hover:bg-transparent">
                      <TableCell>
                        <Input aria-label={`Line ${i + 1} description`} value={item.description} onChange={(ev) => setItem(item.key, { description: ev.target.value })} aria-invalid={!!e("description")} />
                        <FieldError className="mt-1">{e("description")}</FieldError>
                      </TableCell>
                      <TableCell>
                        <Input aria-label={`Line ${i + 1} SAC code`} value={item.sac_code} onChange={(ev) => setItem(item.key, { sac_code: ev.target.value })} inputMode="numeric" />
                      </TableCell>
                      <TableCell>
                        <Input aria-label={`Line ${i + 1} quantity`} value={item.quantity} onChange={(ev) => setItem(item.key, { quantity: ev.target.value })} inputMode="decimal" className="text-right tabular-nums" aria-invalid={!!e("quantity")} />
                        <FieldError className="mt-1">{e("quantity")}</FieldError>
                      </TableCell>
                      <TableCell>
                        <Input aria-label={`Line ${i + 1} unit price`} value={item.unit_price} onChange={(ev) => setItem(item.key, { unit_price: ev.target.value })} inputMode="decimal" placeholder="0.00" className="text-right tabular-nums" aria-invalid={!!e("unit_price")} />
                        <FieldError className="mt-1">{e("unit_price")}</FieldError>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Input aria-label={`Line ${i + 1} discount`} value={item.discount_value} onChange={(ev) => setItem(item.key, { discount_value: ev.target.value })} inputMode="decimal" className="text-right tabular-nums" aria-invalid={!!e("discount_value")} />
                          <Select value={item.discount_type} onValueChange={(v) => setItem(item.key, { discount_type: v as DiscountType })}>
                            <SelectTrigger aria-label={`Line ${i + 1} discount type`} className="w-16 shrink-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="amount">₹</SelectItem>
                              <SelectItem value="percent">%</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <FieldError className="mt-1">{e("discount_value")}</FieldError>
                      </TableCell>
                      {showTax && (
                        <TableCell>
                          <Select value={item.tax_rate} onValueChange={(v) => setItem(item.key, { tax_rate: v })}>
                            <SelectTrigger aria-label={`Line ${i + 1} tax rate`} className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[...new Set(["0", ...taxRates.map((t) => String(t.rate)), item.tax_rate])].map((r) => (
                                <SelectItem key={r} value={r}>
                                  {r}%
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                      <TableCell className="pt-4 text-right font-medium tabular-nums">{formatINR(totals.lines[i]?.total ?? 0n)}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove line ${i + 1}`}
                          disabled={items.length === 1}
                          onClick={() => setItems((l) => l.filter((x) => x.key !== item.key))}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

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

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <Row label="Subtotal" value={totals.subtotal} />
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Discount</span>
                <div className="flex w-40 gap-1">
                  <Input aria-label="Document discount" value={form.discount_value} onChange={(e) => set("discount_value", e.target.value)} inputMode="decimal" className="text-right tabular-nums" aria-invalid={!!err("discount_value")} />
                  <Select value={form.discount_type} onValueChange={(v) => set("discount_type", v as DiscountType)}>
                    <SelectTrigger aria-label="Document discount type" className="w-16 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amount">₹</SelectItem>
                      <SelectItem value="percent">%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {totals.discount > 0n && <Row label="Discount amount" value={-totals.discount} />}
              <Row label="Taxable value" value={totals.taxable} />
              {supplyType === "intra" && showTax && (
                <>
                  <Row label="CGST" value={totals.cgst} />
                  <Row label="SGST" value={totals.sgst} />
                </>
              )}
              {supplyType === "inter" && showTax && <Row label="IGST" value={totals.igst} />}
              {totals.roundOff !== 0n && <Row label="Round off" value={totals.roundOff} />}
              <Separator />
              <div className="flex items-baseline justify-between">
                <span className="font-medium">Total</span>
                <span className="font-heading text-2xl font-semibold tabular-nums">{formatINR(totals.grandTotal)}</span>
              </div>
              {totals.error && <FieldError>{totals.error}</FieldError>}
            </CardContent>
          </Card>
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

function Row({ label, value }: { label: string; value: bigint }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{formatINR(value)}</span>
    </div>
  );
}
