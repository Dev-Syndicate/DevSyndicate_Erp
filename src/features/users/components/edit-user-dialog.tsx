"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { updateUser, userLink } from "@/features/users/actions";
import { LinkResult } from "./link-result";

type User = { id: string; full_name: string; email: string; role_id: string | null; is_active: boolean; last_sign_in_at: string | null };

/** Change role, deactivate / reactivate, or get a new link to set a password (PRD §4–§6). */
export function EditUserDialog({ user, roles, can }: { user: User; roles: { id: string; name: string }[]; can: { update: boolean; deactivate: boolean } }) {
  const [open, setOpen] = useState(false);
  const [roleId, setRoleId] = useState(user.role_id ?? "");
  const [active, setActive] = useState(user.is_active);
  const [link, setLink] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const invited = !user.last_sign_in_at;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setLink(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Manage
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user.full_name || user.email}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`role-${user.id}`}>Role</FieldLabel>
            <Select value={roleId} onValueChange={setRoleId} disabled={!can.update}>
              <SelectTrigger id={`role-${user.id}`} className="w-full">
                <SelectValue placeholder="No role" />
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
          <Field orientation="horizontal">
            <Switch id={`active-${user.id}`} checked={active} onCheckedChange={setActive} disabled={!can.deactivate} />
            <FieldContent>
              <FieldLabel htmlFor={`active-${user.id}`}>Active</FieldLabel>
              <FieldDescription>Inactive users can&apos;t see or change anything, even if they are still signed in. Their history stays.</FieldDescription>
            </FieldContent>
          </Field>
        </FieldGroup>
        {can.update && user.is_active && (
          <>
            <Separator />
            {link ? (
              <LinkResult link={link} email={user.email} />
            ) : (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">
                  {invited ? "Invite link expired or lost?" : "Forgot their password?"} Make a one-time link to set a password.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await userLink(user.id);
                      if (result.error) toast.error(result.error);
                      else setLink(result.link ?? null);
                    })
                  }
                >
                  {invited ? "New invite link" : "Password link"}
                </Button>
              </div>
            )}
          </>
        )}
        <DialogFooter>
          <Button
            disabled={pending || (!can.update && !can.deactivate) || (roleId === user.role_id && active === user.is_active) || !roleId}
            onClick={() =>
              startTransition(async () => {
                const result = await updateUser(user.id, roleId, active);
                if (result.error) toast.error(result.error);
                else {
                  toast.success("User updated");
                  setOpen(false);
                }
              })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
