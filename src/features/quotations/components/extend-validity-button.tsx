"use client";

import { useActionState, useState } from "react";
import { CalendarClock } from "lucide-react";
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
import { DatePicker } from "@/components/date-picker";
import { extendQuotationValidity } from "@/features/quotations/actions";
import type { FormState } from "@/lib/forms";

export function ExtendValidityButton({ id, validUntil }: { id: string; validUntil: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (_prev: FormState, formData: FormData) => {
    const result = await extendQuotationValidity(id, String(formData.get("valid_until") ?? ""));
    if (result.ok) {
      setOpen(false);
      toast.success("Validity extended");
    }
    return result;
  }, {});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <CalendarClock /> Extend validity
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Extend validity</DialogTitle>
          <DialogDescription>The quotation keeps its number. The change is recorded in the audit log.</DialogDescription>
        </DialogHeader>
        <form action={action}>
          <Field data-invalid={!!state.error}>
            <FieldLabel htmlFor="valid_until">Valid until</FieldLabel>
            <DatePicker id="valid_until" name="valid_until" defaultValue={validUntil} aria-invalid={!!state.error} />
            <FieldError>{state.error}</FieldError>
          </Field>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Extend"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
