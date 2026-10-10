"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { applyPayment } from "@/features/payments/actions";
import { formatINR, paise } from "@/lib/money";

type OpenInvoice = { id: string; number: string | null; balance_due: number | null };

const rupees = (p: bigint) => `${p / 100n}.${String(p % 100n).padStart(2, "0")}`;

/** Applies unapplied money (client credit) of a confirmed receipt to one of the client's open invoices. */
export function ApplyCreditButton(props: { paymentId: string; unallocated: number; invoices: OpenInvoice[] }) {
  const [open, setOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [pending, startTransition] = useTransition();

  function pick(id: string) {
    setInvoiceId(id);
    const balance = paise(props.invoices.find((i) => i.id === id)?.balance_due ?? 0);
    const credit = paise(props.unallocated);
    setAmount(rupees(balance < credit ? balance : credit));
  }

  function apply() {
    startTransition(async () => {
      const result = await applyPayment(props.paymentId, invoiceId, amount);
      if (result.error) toast.error(result.error);
      else {
        setOpen(false);
        toast.success("Credit applied");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={props.invoices.length === 0}>
          Apply to invoice
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply credit to an invoice</DialogTitle>
          <DialogDescription>{formatINR(props.unallocated)} of this receipt is not applied yet.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="apply-invoice">Invoice</FieldLabel>
            <Select value={invoiceId} onValueChange={pick}>
              <SelectTrigger id="apply-invoice" className="w-full">
                <SelectValue placeholder="Select an invoice" />
              </SelectTrigger>
              <SelectContent>
                {props.invoices.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.number} · balance {formatINR(i.balance_due ?? 0)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="apply-amount">Amount (₹)</FieldLabel>
            <Input id="apply-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="w-40 tabular-nums" />
            <FieldDescription>Up to this receipt&apos;s unapplied amount and the invoice balance.</FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button disabled={pending || !invoiceId || !amount.trim()} onClick={apply}>
            {pending ? "Applying…" : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
