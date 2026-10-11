"use client";

import { useActionState } from "react";
import { ImageIcon, Upload } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { FilePicker } from "@/components/file-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { removeBranding, uploadBranding } from "@/features/settings/actions";
import type { FormState } from "@/lib/forms";

type Kind = "logo" | "signature";

function ImageField({ kind, label, hint, url, canEdit }: { kind: Kind; label: string; hint: string; url: string | null; canEdit: boolean }) {
  const [, action, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await uploadBranding(kind, prev, formData);
    if (result.ok) toast.success(`${label} updated`);
    else if (result.error) toast.error(result.error);
    return result;
  }, {});

  return (
    <Field>
      <FieldLabel htmlFor={`branding-${kind}`}>{label}</FieldLabel>
      <div className="flex h-28 items-center justify-center rounded-lg border bg-muted/40 p-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
          <img src={url} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <ImageIcon className="size-6 text-muted-foreground" aria-hidden />
        )}
      </div>
      {canEdit && (
        <form action={action} className="flex flex-wrap items-center gap-2">
          <FilePicker key={url ?? "none"} id={`branding-${kind}`} name="file" accept="image/png,image/jpeg" required placeholder="PNG or JPG" className="flex-1" />
          <Button type="submit" variant="outline" disabled={pending}>
            <Upload /> {pending ? "Uploading…" : "Upload"}
          </Button>
          {url && (
            <ConfirmButton
              action={removeBranding.bind(null, kind)}
              title={`Remove ${label.toLowerCase()}?`}
              description="It will no longer appear on quotation and invoice PDFs."
              confirmLabel="Remove"
              successMessage={`${label} removed`}
              variant="ghost"
            >
              Remove
            </ConfirmButton>
          )}
        </form>
      )}
      <FieldDescription>{hint}</FieldDescription>
    </Field>
  );
}

/** Logo and authorised signature printed on quotation and invoice PDFs. */
export function BrandingCard({ logo, signature, canEdit }: { logo: string | null; signature: string | null; canEdit: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>Printed on quotation and invoice PDFs. PNG or JPG, up to 900 KB.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <ImageField kind="logo" label="Logo" hint="Shown at the top left. A wide PNG with a transparent background looks best." url={logo} canEdit={canEdit} />
        <ImageField kind="signature" label="Signature" hint="Shown above the authorised signatory's name (set below under Documents)." url={signature} canEdit={canEdit} />
      </CardContent>
    </Card>
  );
}
