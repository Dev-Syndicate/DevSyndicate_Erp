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
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { invoiceAction } from "@/features/invoices/actions";
import { downloadFile } from "@/lib/download";
import { formatINR } from "@/lib/money";

/** Issues the invoice. When it would exceed its quotation's total, asks for an override reason (PRD §14). */
export function IssueInvoiceButton({ id, credit }: { id: string; credit?: { client: string; amount: number } }) {
  const [open, setOpen] = useState(false);
  const [applyCredit, setApplyCredit] = useState(true);
  const [needsReason, setNeedsReason] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function issue() {
    startTransition(async () => {
      const result = await invoiceAction(id, "issue", needsReason ? reason : undefined, !!credit && applyCredit);
      if (result.needsReason) setNeedsReason(result.error ?? "");
      else if (result.error && !result.ok) toast.error(result.error);
      else {
        setOpen(false);
        // Issuing is sending in V1 (PRD §17): download the numbered PDF to share.
        downloadFile(`/finance/invoices/${id}/pdf`);
        if (result.error) toast.warning(result.error);
        else toast.success(result.applied ? `Invoice issued · ${formatINR(result.applied)} of credit applied` : "Invoice issued");
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
            Assigns the invoice number, records the client&apos;s billing details, locks the content and downloads the PDF to share. Corrections after this need a credit note.
          </DialogDescription>
        </DialogHeader>
        {credit && (
          <Field orientation="horizontal">
            <Checkbox id="apply-credit" checked={applyCredit} onCheckedChange={(v) => setApplyCredit(v === true)} />
            <FieldLabel htmlFor="apply-credit" className="font-normal">
              Apply {credit.client}&apos;s available credit ({formatINR(credit.amount)}) to this invoice
            </FieldLabel>
          </Field>
        )}
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
