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
import { referenceLabel } from "@/lib/payment-methods";
import { uploadDocument } from "@/lib/documents/upload";
import { istToday } from "@/lib/dates";

/** Confirm once the money is in the bank: records the date it arrived and its bank reference (UTR / UPI ID). */
export function ConfirmPaymentButton(props: { id: string; organizationId: string; method: string; paymentDate: string; reference: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(props.paymentDate);
  const [reference, setReference] = useState(props.reference);
  const [proof, setProof] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const label = referenceLabel(props.method);

  function confirm() {
    startTransition(async () => {
      // Proof first: if it fails, nothing is confirmed and the user can retry or confirm without it.
      if (proof) {
        const uploaded = await uploadDocument("payment", props.id, props.organizationId, proof);
        if (uploaded.error) {
          toast.error(uploaded.error);
          return;
        }
        setProof(null); // uploaded: a retry after a failed confirm must not attach it twice
      }
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
          <Field>
            <FieldLabel htmlFor="confirm-proof">Proof of payment received (optional)</FieldLabel>
            <Input
              id="confirm-proof"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setProof(e.target.files?.[0] ?? null)}
            />
            <FieldDescription>Screenshot of the credit in your bank or UPI app. JPG, PNG, WEBP or PDF, up to 5 MB.</FieldDescription>
          </Field>
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
