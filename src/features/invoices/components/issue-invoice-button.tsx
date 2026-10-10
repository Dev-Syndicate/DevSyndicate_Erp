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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { invoiceAction } from "@/features/invoices/actions";

/** Issues the invoice. When it would exceed its quotation's total, asks for an override reason (PRD §14). */
export function IssueInvoiceButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [needsReason, setNeedsReason] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function issue() {
    startTransition(async () => {
      const result = await invoiceAction(id, "issue", needsReason ? reason : undefined);
      if (result.needsReason) setNeedsReason(result.error ?? "");
      else if (result.error) toast.error(result.error);
      else {
        setOpen(false);
        toast.success("Invoice issued");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setNeedsReason(null);
      }}
    >
      <DialogTrigger asChild>
        <Button>Issue invoice</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue invoice?</DialogTitle>
          <DialogDescription>
            Assigns the invoice number, records the client&apos;s billing details and locks the content. Corrections after this need a credit note.
          </DialogDescription>
        </DialogHeader>
        {needsReason !== null && (
          <Field data-invalid>
            <FieldLabel htmlFor="override-reason">Reason for exceeding the quotation</FieldLabel>
            <Textarea id="override-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} aria-invalid />
            <FieldError>{needsReason}</FieldError>
          </Field>
        )}
        <DialogFooter>
          <Button onClick={issue} disabled={pending || (needsReason !== null && !reason.trim())}>
            {pending ? "Issuing…" : "Issue invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
