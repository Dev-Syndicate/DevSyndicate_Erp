"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { deleteContact, saveContact } from "@/features/clients/actions";
import type { FormState } from "@/lib/forms";
import type { Tables } from "@/lib/supabase/database.types";

type Contact = Tables<"client_contacts">;

function ContactDialog({ clientId, contact, trigger }: { clientId: string; contact?: Contact; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await saveContact(clientId, contact?.id ?? null, prev, formData);
    if (result.ok) setOpen(false);
    if (result.error) toast.error(result.error);
    return result;
  }, {});
  const err = state.fieldErrors ?? {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{contact ? "Edit contact" : "Add contact"}</DialogTitle>
        </DialogHeader>
        <form action={action}>
          <FieldGroup>
            {(
              [
                ["name", "Name", "text"],
                ["designation", "Designation", "text"],
                ["email", "Email", "email"],
                ["phone", "Phone", "tel"],
              ] as const
            ).map(([name, label, type]) => (
              <Field key={name} data-invalid={!!err[name]}>
                <FieldLabel htmlFor={`contact-${name}`}>{label}</FieldLabel>
                <Input
                  id={`contact-${name}`}
                  name={name}
                  type={type}
                  defaultValue={contact?.[name] ?? ""}
                  required={name === "name"}
                  aria-invalid={!!err[name]}
                />
                <FieldError>{err[name]}</FieldError>
              </Field>
            ))}
            <Field orientation="horizontal">
              <Switch id="contact-primary" name="is_primary" defaultChecked={contact?.is_primary ?? false} />
              <FieldLabel htmlFor="contact-primary">Primary contact</FieldLabel>
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ContactsCard({ clientId, contacts, canEdit }: { clientId: string; contacts: Contact[]; canEdit: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contacts</CardTitle>
        {canEdit && (
          <CardAction>
            <ContactDialog
              clientId={clientId}
              trigger={
                <Button variant="outline" size="sm">
                  <Plus /> Add
                </Button>
              }
            />
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {contacts.length === 0 && <p className="text-sm text-muted-foreground">No contacts yet.</p>}
        {contacts.map((c) => (
          <div key={c.id} className="flex items-start justify-between gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-col gap-0.5 text-sm">
              <span className="flex items-center gap-2 font-medium">
                {c.name}
                {c.is_primary && <Badge variant="secondary">Primary</Badge>}
              </span>
              {c.designation && <span className="text-muted-foreground">{c.designation}</span>}
              {c.email && <a href={`mailto:${c.email}`} className="text-muted-foreground hover:underline">{c.email}</a>}
              {c.phone && <a href={`tel:${c.phone}`} className="text-muted-foreground hover:underline">{c.phone}</a>}
            </div>
            {canEdit && (
              <div className="flex shrink-0">
                <ContactDialog
                  clientId={clientId}
                  contact={c}
                  trigger={
                    <Button variant="ghost" size="icon" aria-label="Edit contact">
                      <Pencil />
                    </Button>
                  }
                />
                <ConfirmButton
                  action={deleteContact.bind(null, clientId, c.id)}
                  title="Remove contact?"
                  description={`${c.name} will be removed from this client.`}
                  confirmLabel="Remove"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove contact"
                >
                  <Trash2 />
                </ConfirmButton>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
