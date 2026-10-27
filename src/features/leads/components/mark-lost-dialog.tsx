"use client";

import { useState, useTransition } from "react";
import { CircleX } from "lucide-react";
import { toast } from "sonner";
import { issuesByPath } from "@/components/document-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { markLeadLost } from "@/features/leads/actions";
import { LostFields } from "@/features/leads/components/lost-fields";
import { lostSchema } from "@/features/leads/schema";

/** Lost with a reason from the list (PRD §47). Reopen later by editing the status. */
export function MarkLostDialog({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ lost_reason: "", lost_note: "", next_follow_up: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function submit() {
    const parsed = lostSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(issuesByPath(parsed.error.issues));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await markLeadLost(leadId, parsed.data);
      if (result.error) toast.error(result.error);
      if (result.ok) {
        toast.success("Lead marked as lost");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <CircleX /> Mark as lost
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as lost</DialogTitle>
          <DialogDescription>The reason is counted in the Leads report. You can reopen the lead later by editing its status.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <LostFields value={form} onChange={(name, v) => setForm((f) => ({ ...f, [name]: v }))} errors={errors} />
        </FieldGroup>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Mark as lost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
