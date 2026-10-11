import Link from "next/link";
import { Download, Pencil } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { creditNoteAction, deleteCreditNote } from "@/features/credit-notes/actions";
import type { CreditNoteStatus } from "@/features/credit-notes/schema";

/** Buttons for the actions allowed in the current status (mirrors public.credit_note_action). */
export function CreditNoteActions({ id, status, can }: { id: string; status: CreditNoteStatus; can: (permission: string) => boolean }) {
  const draft = status === "draft";
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" asChild>
        <a href={`/finance/credit-notes/${id}/pdf`} download>
          <Download /> {draft ? "Preview PDF" : "PDF"}
        </a>
      </Button>
      {draft && can("credit_notes.create") && (
        <>
          <Button variant="outline" asChild>
            <Link href={`/finance/credit-notes/${id}/edit`}>
              <Pencil /> Edit
            </Link>
          </Button>
          <ConfirmButton action={deleteCreditNote.bind(null, id)} title="Delete draft?" description="This draft will be removed permanently." confirmLabel="Delete" variant="outline">
            Delete
          </ConfirmButton>
          <ConfirmButton
            action={creditNoteAction.bind(null, id, "issue")}
            title="Issue credit note?"
            description="Assigns the number, reduces what the client owes on the invoice and downloads the PDF to share. If the invoice was already paid, the overpaid part becomes client credit (apply it to another invoice or refund it)."
            confirmLabel="Issue and download PDF"
            successMessage="Credit note issued. PDF downloading."
            downloadOnSuccess={`/finance/credit-notes/${id}/pdf`}
          >
            Issue credit note
          </ConfirmButton>
        </>
      )}
      {status === "issued" && can("credit_notes.cancel") && (
        <ConfirmButton
          action={creditNoteAction.bind(null, id, "cancel")}
          title="Cancel credit note?"
          description="It keeps its number and stays on record as cancelled. The invoice balance goes back up."
          confirmLabel="Cancel credit note"
          successMessage="Credit note cancelled"
          variant="outline"
        >
          Cancel
        </ConfirmButton>
      )}
    </div>
  );
}
