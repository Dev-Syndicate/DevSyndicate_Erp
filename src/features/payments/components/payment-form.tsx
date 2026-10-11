"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { issuesByPath } from "@/components/document-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { savePayment } from "@/features/payments/actions";
import { METHODS, paymentSchema, type PaymentInput } from "@/features/payments/schema";
import { formatDate, istToday } from "@/lib/dates";
import { formatINR, paise, toScaled } from "@/lib/money";

type Client = { id: string; company_name: string; client_credit: number | null };
type OpenInvoice = { id: string; number: string | null; client_id: string; invoice_date: string; due_date: string | null; balance_due: number | null };
type Saved = {
  id: string;
  client_id: string;
  kind: string;
  payment_date: string;
  amount: number;
  tds_amount: number;
  method: string;
  reference: string;
  notes: string;
  payment_allocations: { invoice_id: string; amount: number }[];
};

type Props = {
  clients: Client[];
  invoices: OpenInvoice[];
  canRefund: boolean;
  payment?: Saved;
  /** "Record payment" from an invoice: preselect its client and settle its balance. */
  presetInvoiceId?: string;
};

const scaled = (v: string) => toScaled(v || "0", 2) ?? 0n;
const rupees = (p: bigint) => `${p / 100n}.${String(p % 100n).padStart(2, "0")}`;

export function PaymentForm({ clients, invoices, canRefund, payment, presetInvoiceId }: Props) {
  const preset = invoices.find((i) => i.id === presetInvoiceId);
  const [form, setForm] = useState<Omit<PaymentInput, "allocations">>(() => ({
    client_id: payment?.client_id ?? preset?.client_id ?? "",
    kind: (payment?.kind as PaymentInput["kind"]) ?? "receipt",
    payment_date: payment?.payment_date ?? istToday(),
    amount: payment ? String(payment.amount) : preset ? String(preset.balance_due ?? "") : "",
    tds_amount: String(payment?.tds_amount ?? 0),
    method: (payment?.method as PaymentInput["method"]) ?? "bank_transfer",
    reference: payment?.reference ?? "", // asked when confirming
    notes: payment?.notes ?? "",
  }));
  // Amount to apply per invoice id (empty = not applied).
  const [applied, setApplied] = useState<Record<string, string>>(() =>
    payment
      ? Object.fromEntries(payment.payment_allocations.map((a) => [a.invoice_id, String(a.amount)]))
      : preset
        ? { [preset.id]: String(preset.balance_due ?? "") }
        : {},
  );
  // Until the user types in an Apply box, the amount is applied automatically (preset invoice first, then oldest).
  const [manual, setManual] = useState(!!payment);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof typeof form>(name: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [name]: value }));
  const client = clients.find((c) => c.id === form.client_id);
  const receipt = form.kind === "receipt";
  const open = invoices.filter((i) => i.client_id === form.client_id);

  // Live figures in paise.
  const settled = scaled(form.amount) + (receipt ? scaled(form.tds_amount) : 0n);
  const appliedTotal = receipt ? Object.values(applied).reduce((s, v) => s + scaled(v), 0n) : 0n;
  const leftover = settled - appliedTotal;

  /** Spreads amount + TDS over the client's open invoices: the invoice we came from first, then oldest first. */
  function distribute(clientId: string, amount: string, tds: string): Record<string, string> {
    let room = scaled(amount) + scaled(tds);
    const next: Record<string, string> = {};
    const list = invoices.filter((i) => i.client_id === clientId);
    const ordered = [...list.filter((i) => i.id === presetInvoiceId), ...list.filter((i) => i.id !== presetInvoiceId)];
    for (const inv of ordered) {
      const balance = paise(inv.balance_due ?? 0);
      const take = room < balance ? room : balance;
      if (take <= 0n) break;
      next[inv.id] = rupees(take);
      room -= take;
    }
    return next;
  }

  function changeAmount(field: "amount" | "tds_amount", value: string) {
    set(field, value);
    if (!manual) {
      const next = { ...form, [field]: value };
      setApplied(distribute(form.client_id, next.amount, next.tds_amount));
    }
  }

  function fill(inv: OpenInvoice) {
    const others = appliedTotal - scaled(applied[inv.id] ?? "");
    const room = settled - others;
    const balance = paise(inv.balance_due ?? 0);
    const value = room < balance ? room : balance;
    setApplied((a) => ({ ...a, [inv.id]: value > 0n ? rupees(value) : "" }));
  }

  function submit() {
    const input: PaymentInput = {
      ...form,
      tds_amount: receipt ? form.tds_amount || "0" : "0",
      allocations: receipt
        ? Object.entries(applied)
            .filter(([invoiceId, v]) => v.trim() && open.some((i) => i.id === invoiceId))
            .map(([invoice_id, amount]) => ({ invoice_id, amount }))
        : [],
    };
    const parsed = paymentSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(issuesByPath(parsed.error.issues));
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await savePayment(payment?.id ?? null, input);
      if (result?.error) toast.error(result.error);
    });
  }

  const err = (k: string) => errors[k];

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
            <CardTitle>Payment</CardTitle>
            <CardDescription>Saved as pending. When the money is in your account, confirm it and add the bank reference.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field data-invalid={!!err("client_id")} className="lg:col-span-2">
                <FieldLabel htmlFor="client_id">Client</FieldLabel>
                <Select
                  value={form.client_id}
                  onValueChange={(v) => {
                    set("client_id", v);
                    setManual(false);
                    setApplied(distribute(v, form.amount, form.tds_amount));
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
                {client && (client.client_credit ?? 0) > 0 ? (
                  <FieldDescription>Available client credit: {formatINR(client.client_credit ?? 0)}</FieldDescription>
                ) : (
                  <FieldError>{err("client_id")}</FieldError>
                )}
              </Field>
              <Field data-invalid={!!err("kind")}>
                <FieldLabel htmlFor="kind">Type</FieldLabel>
                <Select value={form.kind} onValueChange={(v) => set("kind", v as PaymentInput["kind"])} disabled={!!payment || !canRefund}>
                  <SelectTrigger id="kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receipt">Money received</SelectItem>
                    <SelectItem value="refund">Refund to client</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError>{err("kind")}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="payment_date">Date</FieldLabel>
                <Input id="payment_date" type="date" value={form.payment_date} onChange={(e) => set("payment_date", e.target.value)} />
              </Field>
              <Field data-invalid={!!err("amount")}>
                <FieldLabel htmlFor="amount">{receipt ? "Amount received (₹)" : "Amount refunded (₹)"}</FieldLabel>
                <Input id="amount" value={form.amount} onChange={(e) => changeAmount("amount", e.target.value)} inputMode="decimal" placeholder="0.00" className="tabular-nums" aria-invalid={!!err("amount")} />
                <FieldError>{err("amount")}</FieldError>
              </Field>
              {receipt && (
                <Field data-invalid={!!err("tds_amount")}>
                  <FieldLabel htmlFor="tds_amount">TDS deducted (₹)</FieldLabel>
                  <Input id="tds_amount" value={form.tds_amount} onChange={(e) => changeAmount("tds_amount", e.target.value)} inputMode="decimal" className="tabular-nums" aria-invalid={!!err("tds_amount")} />
                  <FieldDescription>If the client withheld income tax, e.g. 10% of the value before GST.</FieldDescription>
                  <FieldError>{err("tds_amount")}</FieldError>
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="method">Method</FieldLabel>
                <Select value={form.method} onValueChange={(v) => set("method", v as PaymentInput["method"])}>
                  <SelectTrigger id="method" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field className="sm:col-span-2 lg:col-span-4">
                <FieldLabel htmlFor="notes">Notes</FieldLabel>
                <Textarea id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        {receipt && (
          <Card>
            <CardHeader>
              <CardTitle>Apply to invoices</CardTitle>
              <CardDescription>
                The amount is applied to open invoices automatically (oldest first). Change it if needed; whatever you don&apos;t apply
                stays with the client as credit (an advance).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {!client ? (
                <p className="text-sm text-muted-foreground">Select a client to see their open invoices.</p>
              ) : open.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open invoices. This payment will be held as an advance.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="w-56">Apply (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {open.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-sm">{inv.number}</TableCell>
                        <TableCell className="tabular-nums">{formatDate(inv.invoice_date)}</TableCell>
                        <TableCell className="tabular-nums">{formatDate(inv.due_date)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatINR(inv.balance_due ?? 0)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Input
                              aria-label={`Apply to ${inv.number}`}
                              value={applied[inv.id] ?? ""}
                              onChange={(e) => {
                                setManual(true);
                                setApplied((a) => ({ ...a, [inv.id]: e.target.value }));
                              }}
                              inputMode="decimal"
                              placeholder="0.00"
                              className="tabular-nums"
                            />
                            <Button type="button" variant="outline" onClick={() => fill(inv)}>
                              Fill
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <Separator />
              <div className="grid gap-2 text-sm sm:max-w-sm sm:self-end">
                <Row label="Received + TDS" value={settled} />
                <Row label="Applied to invoices" value={-appliedTotal} />
                <div className="flex justify-between gap-3 font-medium">
                  <span>{leftover < 0n ? "Over-applied" : "Held as client credit"}</span>
                  <span className={leftover < 0n ? "text-destructive tabular-nums" : "tabular-nums"}>{formatINR(leftover)}</span>
                </div>
                <FieldError>{err("allocations")}</FieldError>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" asChild>
            <Link href={payment ? `/finance/payments/${payment.id}` : "/finance/payments"}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : payment ? "Save" : "Record payment"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

function Row({ label, value }: { label: string; value: bigint }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{formatINR(value)}</span>
    </div>
  );
}
