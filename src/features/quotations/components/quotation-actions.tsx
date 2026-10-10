import Link from "next/link";
import { Copy, Download, Pencil } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { deleteQuotation, quotationAction } from "@/features/quotations/actions";
import { ConvertQuotationButton } from "@/features/quotations/components/convert-quotation-button";
import { ExtendValidityButton } from "@/features/quotations/components/extend-validity-button";
import type { QuotationStatus } from "@/features/quotations/schema";

type Props = {
  id: string;
  status: QuotationStatus;
  validUntil: string;
  hasNewerRevision: boolean;
  can: (permission: string) => boolean;
  convert: Omit<Parameters<typeof ConvertQuotationButton>[0], "id">;
};

/** Buttons for the actions allowed in the current status (mirrors public.quotation_action). */
export function QuotationActions({ id, status, validUntil, hasNewerRevision, can, convert }: Props) {
  const act = (action: Parameters<typeof quotationAction>[1]) => quotationAction.bind(null, id, action);

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" asChild>
        <a href={`/finance/quotations/${id}/pdf`} download>
          <Download /> {status === "draft" ? "Preview PDF" : "PDF"}
        </a>
      </Button>
      {status === "draft" && can("quotations.update") && (
        <Button variant="outline" asChild>
          <Link href={`/finance/quotations/${id}/edit`}>
            <Pencil /> Edit
          </Link>
        </Button>
      )}
      {status === "draft" && can("quotations.delete") && (
        <ConfirmButton action={deleteQuotation.bind(null, id)} title="Delete draft?" description="This draft will be removed permanently." confirmLabel="Delete" variant="outline">
          Delete
        </ConfirmButton>
      )}
      {(status === "sent" || status === "expired" || status === "rejected") && can("quotations.update") && !hasNewerRevision && (
        <ConfirmButton action={act("revise")} title="Revise quotation?" description="Creates a new draft revision with the same number. Sending it replaces this one." confirmLabel="Revise" variant="outline">
          Revise
        </ConfirmButton>
      )}
      {(status === "sent" || status === "accepted" || status === "expired") && can("quotations.update") && (
        <ConfirmButton action={act("cancel")} title="Cancel quotation?" description="The quotation stays on record as cancelled." confirmLabel="Cancel quotation" successMessage="Quotation cancelled" variant="outline">
          Cancel
        </ConfirmButton>
      )}
      {can("quotations.create") && (
        <ConfirmButton action={act("duplicate")} title="Duplicate quotation?" description="Creates a new draft with the same client and lines." confirmLabel="Duplicate" variant="outline">
          <Copy /> Duplicate
        </ConfirmButton>
      )}
      {(status === "sent" || status === "expired") && can("quotations.update") && (
        <ExtendValidityButton id={id} validUntil={validUntil} />
      )}
      {status === "sent" && can("quotations.update") && (
        <>
          <ConfirmButton action={act("reject")} title="Mark as rejected?" description="Record that the client declined this quotation." confirmLabel="Mark rejected" successMessage="Marked as rejected" variant="outline">
            Mark rejected
          </ConfirmButton>
          <ConfirmButton action={act("accept")} title="Mark as accepted?" description="Record that the client accepted. Accepted quotations can be converted to invoices." confirmLabel="Mark accepted" successMessage="Marked as accepted">
            Mark accepted
          </ConfirmButton>
        </>
      )}
      {(status === "accepted" || status === "partially_invoiced" || status === "invoiced") &&
        can("quotations.convert") &&
        can("invoices.create") && <ConvertQuotationButton id={id} {...convert} />}
      {status === "draft" && can("quotations.send") && (
        <ConfirmButton action={act("send")} title="Mark as sent?" description="Assigns the quotation number and locks the content. Share the quotation with your client yourself." confirmLabel="Mark as sent" successMessage="Quotation marked as sent">
          Mark as sent
        </ConfirmButton>
      )}
    </div>
  );
}
