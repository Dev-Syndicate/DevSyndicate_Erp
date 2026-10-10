import Link from "next/link";
import { Download, Pencil } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { deletePayment, paymentAction } from "@/features/payments/actions";
import { ApplyCreditButton } from "./apply-credit-button";
import { CancelPaymentButton } from "./cancel-payment-button";

type Props = {
  p: { id: string; kind: string; status: string; unallocated: number | null };
  openInvoices: { id: string; number: string | null; balance_due: number | null }[];
  can: (permission: string) => boolean;
};

/** Buttons for the actions allowed in the current status (mirrors public.payment_action). */
export function PaymentActions({ p, openInvoices, can }: Props) {
  const pending = p.status === "pending";
  const confirmed = p.status === "confirmed";
  const canWrite = can(p.kind === "refund" ? "payments.refund" : "payments.create");

  return (
    <div className="flex flex-wrap gap-2">
      {confirmed && (
        <Button variant="outline" asChild>
          <a href={`/finance/payments/${p.id}/pdf`} download>
            <Download /> Receipt
          </a>
        </Button>
      )}
      {pending && canWrite && (
        <Button variant="outline" asChild>
          <Link href={`/finance/payments/${p.id}/edit`}>
            <Pencil /> Edit
          </Link>
        </Button>
      )}
      {pending && can("payments.create") && (
        <ConfirmButton action={deletePayment.bind(null, p.id)} title="Delete pending payment?" description="It is removed permanently." confirmLabel="Delete" variant="outline">
          Delete
        </ConfirmButton>
      )}
      {p.status !== "cancelled" && can("payments.cancel") && <CancelPaymentButton id={p.id} />}
      {confirmed && p.kind === "receipt" && (p.unallocated ?? 0) > 0 && can("payments.update") && (
        <ApplyCreditButton paymentId={p.id} unallocated={p.unallocated ?? 0} invoices={openInvoices} />
      )}
      {pending && can("payments.update") && (
        <ConfirmButton
          action={paymentAction.bind(null, p.id, "confirm", undefined)}
          title="Confirm payment?"
          description="Confirm only once the money is in your account. It then counts toward invoices and client credit and gets a receipt number."
          confirmLabel="Confirm"
          successMessage="Payment confirmed"
        >
          Confirm
        </ConfirmButton>
      )}
    </div>
  );
}
