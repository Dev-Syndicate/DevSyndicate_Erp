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
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { paymentAction } from "@/features/payments/actions";

/** Cancelling needs a reason, which is logged (PRD §19). */
export function CancelPaymentButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function cancel() {
    startTransition(async () => {
      const result = await paymentAction(id, "cancel", reason);
      if (result.error) toast.error(result.error);
      else {
        setOpen(false);
        toast.success("Payment cancelled");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Cancel</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel payment?</DialogTitle>
          <DialogDescription>
            It stops counting toward invoices and client credit but stays on record. To correct a confirmed payment, cancel it
            and record it again.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="cancel-reason">Reason</FieldLabel>
          <Textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. Entered twice" />
        </Field>
        <DialogFooter>
          <Button variant="destructive" disabled={pending || !reason.trim()} onClick={cancel}>
            {pending ? "Cancelling…" : "Cancel payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
