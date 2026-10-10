import Link from "next/link";
import { Copy, Download, Pencil } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { deleteInvoice, invoiceAction } from "@/features/invoices/actions";
import type { InvoiceStatus } from "@/features/invoices/schema";
import { IssueInvoiceButton } from "./issue-invoice-button";

type Props = { id: string; status: InvoiceStatus; can: (permission: string) => boolean };

/** Buttons for the actions allowed in the current status (mirrors public.invoice_action). */
export function InvoiceActions({ id, status, can }: Props) {
  const issued = status === "issued" || status === "overdue";

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" asChild>
        <a href={`/finance/invoices/${id}/pdf`} download>
          <Download /> PDF
        </a>
      </Button>
      {status === "draft" && can("invoices.update") && (
        <Button variant="outline" asChild>
          <Link href={`/finance/invoices/${id}/edit`}>
            <Pencil /> Edit
          </Link>
        </Button>
      )}
      {status === "draft" && can("invoices.delete") && (
        <ConfirmButton action={deleteInvoice.bind(null, id)} title="Delete draft?" description="This draft will be removed permanently." confirmLabel="Delete" variant="outline">
          Delete
        </ConfirmButton>
      )}
      {issued && can("invoices.cancel") && (
        <ConfirmButton
          action={invoiceAction.bind(null, id, "cancel", undefined)}
          title="Cancel invoice?"
          description="The invoice keeps its number and stays on record as cancelled. This can't be undone."
          confirmLabel="Cancel invoice"
          successMessage="Invoice cancelled"
          variant="outline"
        >
          Cancel
        </ConfirmButton>
      )}
      {can("invoices.create") && (
        <ConfirmButton action={invoiceAction.bind(null, id, "duplicate", undefined)} title="Duplicate invoice?" description="Creates a new draft with the same client and lines." confirmLabel="Duplicate" variant="outline">
          <Copy /> Duplicate
        </ConfirmButton>
      )}
      {status === "draft" && can("invoices.issue") && <IssueInvoiceButton id={id} />}
    </div>
  );
}
