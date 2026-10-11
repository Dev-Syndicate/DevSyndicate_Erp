"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/** One-time sign-in link to copy and send by WhatsApp or email (PRD §6.1). */
export function LinkResult({ link, email }: { link: string; email: string }) {
  return (
    <Field>
      <FieldLabel htmlFor="user-link">Link for {email}</FieldLabel>
      <div className="flex gap-2">
        <Input id="user-link" value={link} readOnly onFocus={(e) => e.target.select()} className="font-mono text-xs" />
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            navigator.clipboard.writeText(link).then(
              () => toast.success("Link copied"),
              () => toast.error("Copy failed; select the link and copy it by hand."),
            )
          }
        >
          <Copy /> Copy
        </Button>
      </div>
      <FieldDescription>
        It opens a page to set their password, works once and expires in 24 hours. You can make a new one any time.
      </FieldDescription>
    </Field>
  );
}
