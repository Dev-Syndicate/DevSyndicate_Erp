"use client";

import { useState, useTransition } from "react";
import { Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { convertLead } from "@/features/leads/actions";

const NEW = "new";

/** Won: create the client from the lead, or link a client that already exists (PRD §47). */
export function ConvertLeadDialog({ leadId, newName, clients }: { leadId: string; newName: string; clients: { id: string; company_name: string }[] }) {
  const [client, setClient] = useState(NEW);
  const [pending, startTransition] = useTransition();

  function convert() {
    startTransition(async () => {
      // Opens the client on success.
      const result = await convertLead(leadId, client === NEW ? null : client);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Trophy /> Mark as won
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as won</DialogTitle>
          <DialogDescription>The lead becomes a client, so you can send a quotation. The lead can&apos;t be edited after this.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="convert-client">Client</FieldLabel>
          <Select value={client} onValueChange={setClient}>
            <SelectTrigger id="convert-client" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NEW}>New client: {newName}</SelectItem>
              {clients.length > 0 && <SelectSeparator />}
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            {client === NEW ? "Creates the client with this person as its primary contact." : "Links the lead to this client; no new contact is added."}
          </FieldDescription>
        </Field>
        <DialogFooter>
          <Button onClick={convert} disabled={pending}>
            {pending ? "Saving…" : "Mark as won"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
