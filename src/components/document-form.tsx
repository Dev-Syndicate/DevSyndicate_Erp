"use client";

// Form parts shared by quotations and invoices: party fields, line items and the live summary.

import { useMemo } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { INDIAN_STATES } from "@/lib/india";
import type { LineItemInput } from "@/lib/line-items";
import { calculateDocument, formatINR, type DiscountType, type DocumentTotals, type SupplyType } from "@/lib/money";

export type FormClient = {
  id: string;
  company_name: string;
  state: string;
  country: string;
  payment_terms_days?: number | null;
  client_contacts: { id: string; name: string; is_primary: boolean }[];
};
export type FormSettings = {
  state: string;
  gst_registered: boolean;
  round_off: boolean;
  default_sac_code: string;
  tax_rates: { rate: number } | null;
} | null;
export type TaxRate = { id: string; name: string; rate: number };
export type LineItem = LineItemInput & { key: string };
type StoredItem = {
  id: string;
  description: string;
  sac_code: string;
  quantity: number;
  unit_price: number;
  discount_type: string;
  discount_value: number;
  tax_rate: number;
};

/** New line. SAC isn't edited per line: it comes from the company default (Settings → Company). */
export const blankLine = (settings: FormSettings): LineItem => ({
  key: crypto.randomUUID(),
  description: "",
  sac_code: settings?.default_sac_code ?? "",
  quantity: "1",
  unit_price: "",
  discount_type: "amount",
  discount_value: "0",
  tax_rate: String(settings?.tax_rates?.rate ?? 0),
});

/** Saved items → editable lines. */
export const linesFrom = (items: StoredItem[]): LineItem[] =>
  items.map((i) => ({
    key: i.id,
    description: i.description,
    sac_code: i.sac_code,
    quantity: String(i.quantity),
    unit_price: String(i.unit_price),
    discount_type: i.discount_type as DiscountType,
    discount_value: String(i.discount_value),
    tax_rate: String(i.tax_rate),
  }));

/** Mirrors save_quotation / save_invoice: export outside India, else intra when place of supply = company state. */
export function supplyTypeFor(client: FormClient | undefined, placeOfSupply: string, settings: FormSettings): SupplyType {
  if (!client) return "intra";
  if (client.country !== "India") return "export";
  return placeOfSupply === settings?.state ? "intra" : "inter";
}

export function useDocumentTotals(
  items: LineItem[],
  discount: { discount_type: DiscountType; discount_value: string },
  supplyType: SupplyType,
  settings: FormSettings,
): DocumentTotals {
  const gst = settings?.gst_registered ?? false;
  const roundOff = settings?.round_off ?? false;
  return useMemo(
    () =>
      calculateDocument({
        lines: items.map((i) => ({
          quantity: i.quantity,
          unitPrice: i.unit_price || "0",
          discountType: i.discount_type,
          discountValue: i.discount_value,
          taxRate: i.tax_rate,
        })),
        discountType: discount.discount_type,
        discountValue: discount.discount_value,
        supplyType,
        gstApplicable: gst,
        roundOff,
      }),
    [items, discount.discount_type, discount.discount_value, supplyType, gst, roundOff],
  );
}

/** Client + contact selects. Picking a client selects its primary contact. */
export function ClientContactFields(props: {
  clients: FormClient[];
  clientId: string;
  contactId: string;
  error?: string;
  onClientChange: (client: FormClient) => void;
  onContactChange: (contactId: string) => void;
}) {
  const { clients, clientId, contactId, error } = props;
  const client = clients.find((c) => c.id === clientId);
  return (
    <>
      <Field data-invalid={!!error} className="lg:col-span-2">
        <FieldLabel htmlFor="client_id">Client</FieldLabel>
        <Select value={clientId} onValueChange={(v) => props.onClientChange(clients.find((c) => c.id === v)!)}>
          <SelectTrigger id="client_id" className="w-full" aria-invalid={!!error}>
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
          <FieldError>{error}</FieldError>
        )}
      </Field>
      <Field className="lg:col-span-2">
        <FieldLabel htmlFor="contact_id">Contact</FieldLabel>
        <Select value={contactId || undefined} onValueChange={props.onContactChange} disabled={!client?.client_contacts.length}>
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
    </>
  );
}

/** Primary contact of a client, else its first contact. */
export const defaultContactId = (client: FormClient) =>
  (client.client_contacts.find((c) => c.is_primary) ?? client.client_contacts[0])?.id ?? "";

export function PlaceOfSupplyField(props: {
  client: FormClient | undefined;
  value: string;
  supplyType: SupplyType;
  gst: boolean;
  onChange: (state: string) => void;
}) {
  const { client, value, supplyType, gst } = props;
  return (
    <Field className="sm:col-span-2">
      <FieldLabel htmlFor="place_of_supply">Place of supply</FieldLabel>
      <Select value={value || undefined} onValueChange={props.onChange} disabled={client?.country !== "India"}>
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
  );
}

function DiscountInput(props: {
  label: string;
  value: string;
  type: DiscountType;
  invalid?: boolean;
  onValue: (value: string) => void;
  onType: (type: DiscountType) => void;
}) {
  return (
    <>
      <Input aria-label={props.label} value={props.value} onChange={(e) => props.onValue(e.target.value)} inputMode="decimal" className="text-right tabular-nums" aria-invalid={props.invalid} />
      <Select value={props.type} onValueChange={(v) => props.onType(v as DiscountType)}>
        <SelectTrigger aria-label={`${props.label} type`} className="w-16 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="amount">₹</SelectItem>
          <SelectItem value="percent">%</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}

export function LineItemsCard(props: {
  items: LineItem[];
  setItems: (update: (items: LineItem[]) => LineItem[]) => void;
  newLine: () => LineItem;
  totals: DocumentTotals;
  showTax: boolean;
  taxRates: TaxRate[];
  /** Errors keyed like "items.0.quantity". */
  errors: Record<string, string>;
}) {
  const { items, setItems, totals, showTax, taxRates, errors } = props;
  const setItem = (k: string, patch: Partial<LineItem>) => setItems((list) => list.map((i) => (i.key === k ? { ...i, ...patch } : i)));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Line items</CardTitle>
        <CardDescription>Amounts are in ₹. Totals update as you type and are recalculated on save.</CardDescription>
        <CardAction>
          <Button type="button" variant="outline" onClick={() => setItems((l) => [...l, props.newLine()])}>
            <Plus /> Add line
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Table className="min-w-[50rem]">
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
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
              const e = (f: string) => errors[`items.${i}.${f}`];
              return (
                <TableRow key={item.key} className="align-top hover:bg-transparent">
                  <TableCell>
                    <Input aria-label={`Line ${i + 1} description`} value={item.description} onChange={(ev) => setItem(item.key, { description: ev.target.value })} aria-invalid={!!e("description")} />
                    <FieldError className="mt-1">{e("description")}</FieldError>
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
                      <DiscountInput
                        label={`Line ${i + 1} discount`}
                        value={item.discount_value}
                        type={item.discount_type}
                        invalid={!!e("discount_value")}
                        onValue={(v) => setItem(item.key, { discount_value: v })}
                        onType={(t) => setItem(item.key, { discount_type: t })}
                      />
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
  );
}

export function SummaryCard(props: {
  totals: DocumentTotals;
  supplyType: SupplyType;
  showTax: boolean;
  discountType: DiscountType;
  discountValue: string;
  discountError?: string;
  onDiscountValue: (value: string) => void;
  onDiscountType: (type: DiscountType) => void;
}) {
  const { totals, supplyType, showTax } = props;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Summary</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <Row label="Subtotal" value={totals.subtotal} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Discount</span>
          <div className="flex w-40 gap-1">
            <DiscountInput
              label="Document discount"
              value={props.discountValue}
              type={props.discountType}
              invalid={!!props.discountError}
              onValue={props.onDiscountValue}
              onType={props.onDiscountType}
            />
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

/** Zod issues → "items.0.quantity"-style keys for LineItemsCard and the header fields. */
export function issuesByPath(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) out[issue.path.join(".")] ??= issue.message;
  return out;
}
