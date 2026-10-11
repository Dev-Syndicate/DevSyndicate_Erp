"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inviteUser } from "@/features/users/actions";
import { LinkResult } from "./link-result";

type Role = { id: string; name: string };

export function InviteUserDialog({ roles }: { roles: Role[] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", role_id: "" });
  const [link, setLink] = useState<string | null>(null);
  const [emailed, setEmailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setForm({ full_name: "", email: "", role_id: "" });
      setLink(null);
      setEmailed(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus /> Invite user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{link ? (emailed ? "Invite sent" : "Invite created") : "Invite user"}</DialogTitle>
          <DialogDescription>
            {link
              ? emailed
                ? `We emailed the invite to ${form.email}. You can also send them this link yourself.`
                : `The email couldn't be sent, so send ${form.full_name} this link yourself.`
              : "They get an email with a one-time link to set their password."}
          </DialogDescription>
        </DialogHeader>
        {link ? (
          <LinkResult link={link} email={form.email} />
        ) : (
          <form
            id="invite-form"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const result = await inviteUser(form);
                if (result.error) toast.error(result.error);
                else {
                  setLink(result.link ?? null);
                  setEmailed(!!result.emailed);
                }
              });
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="invite-name">Name</FieldLabel>
                <Input id="invite-name" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                <Input id="invite-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="invite-role">Role</FieldLabel>
                <Select value={form.role_id} onValueChange={(v) => setForm((f) => ({ ...f, role_id: v }))}>
                  <SelectTrigger id="invite-role" className="w-full">
                    <SelectValue placeholder="Choose a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </form>
        )}
        <DialogFooter>
          {link ? (
            <Button onClick={() => reset(false)}>Done</Button>
          ) : (
            <Button type="submit" form="invite-form" disabled={pending || !form.role_id}>
              {pending ? "Creating…" : "Create invite link"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
