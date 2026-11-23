"use client";

import { useState, useTransition } from "react";
import { Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { generateWebsiteFormKey } from "@/features/settings/actions";

/** Key the website's server sends with contact-form enquiries (PRD §47). Shown once; regenerating revokes the old one. */
export function WebsiteFormCard({ hasKey, canEdit }: { hasKey: boolean; canEdit: boolean }) {
  const [key, setKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      const result = await generateWebsiteFormKey();
      if (result.key) setKey(result.key);
      else toast.error(result.error ?? "Could not make a key.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Website contact form</CardTitle>
        <CardDescription>
          Enquiries from the website&apos;s contact form become Website leads. The website&apos;s server sends them to{" "}
          <code className="font-mono">POST /api/leads/website</code> with this key. {hasKey || key ? "A key is set." : "No key yet, so the form can't send enquiries."}
        </CardDescription>
        {canEdit && (
          <CardAction>
            {hasKey || key ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={pending}>
                    <KeyRound /> {pending ? "Making…" : "Regenerate key"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Make a new key?</AlertDialogTitle>
                    <AlertDialogDescription>The old key stops working at once. The website can&apos;t send enquiries until you put the new key in its settings.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={generate}>Make new key</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button variant="outline" onClick={generate} disabled={pending}>
                <KeyRound /> {pending ? "Making…" : "Generate key"}
              </Button>
            )}
          </CardAction>
        )}
      </CardHeader>
      {key && (
        <CardContent>
          <Field>
            <FieldLabel htmlFor="website-form-key">New key</FieldLabel>
            <div className="flex gap-2">
              <Input id="website-form-key" value={key} readOnly onFocus={(e) => e.target.select()} className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  navigator.clipboard.writeText(key).then(
                    () => toast.success("Key copied"),
                    () => toast.error("Copy failed; select the key and copy it by hand."),
                  )
                }
              >
                <Copy /> Copy
              </Button>
            </div>
            <FieldDescription>
              Shown only now. Put it in the website&apos;s server environment (e.g. <code className="font-mono">ERP_FORM_KEY</code>), never in browser code.
            </FieldDescription>
          </Field>
        </CardContent>
      )}
    </Card>
  );
}
