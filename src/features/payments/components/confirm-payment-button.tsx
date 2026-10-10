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
import { paymentAction } from "@/features/payments/actions";
import { referenceLabel } from "@/features/payments/schema";
import { istToday } from "@/lib/dates";

/** Confirm once the money is in the bank: records the date it arrived and its bank reference (UTR / UPI ID). */
export function ConfirmPaymentButton(props: { id: string; method: string; paymentDate: string; reference: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(props.paymentDate);
  const [reference, setReference] = useState(props.reference);
  const [pending, startTransition] = useTransition();
  const label = referenceLabel(props.method);

  function confirm() {
    startTransition(async () => {
      const result = await paymentAction(props.id, "confirm", undefined, { payment_date: date, reference });
      if (result.error) toast.error(result.error);
      else {
        setOpen(false);
        toast.success("Payment confirmed");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Confirm</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm payment received?</DialogTitle>
          <DialogDescription>
            Check your bank or UPI app first. Once confirmed, it counts toward invoices and client credit and gets a receipt number.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="confirm-date">Date received</FieldLabel>
            <Input id="confirm-date" type="date" value={date} max={istToday()} onChange={(e) => setDate(e.target.value)} className="w-48" />
          </Field>
          {label && (
            <Field>
              <FieldLabel htmlFor="confirm-reference">{label.label}</FieldLabel>
              <Input id="confirm-reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={label.example} />
              <FieldDescription>{label.hint}</FieldDescription>
            </Field>
          )}
        </FieldGroup>
        <DialogFooter>
          <Button onClick={confirm} disabled={pending || !date}>
            {pending ? "Confirming…" : "Confirm payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
