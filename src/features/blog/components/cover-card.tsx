"use client";

import { useActionState } from "react";
import { ImageIcon, Upload } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { FilePicker } from "@/components/file-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { removeCover, saveCover } from "@/features/blog/actions";
import type { FormState } from "@/lib/forms";

type Props = { postId: string; url: string | null; alt: string; canEdit: boolean };

/** Cover image (also the link-preview image) with its alt text. */
export function CoverCard({ postId, url, alt, canEdit }: Props) {
  const [state, action, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await saveCover(postId, prev, formData);
    if (result.ok) toast.success("Cover saved");
    else if (result.error) toast.error(result.error);
    return result;
  }, {});
  const err = state.fieldErrors ?? {};

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cover image</CardTitle>
        <CardDescription>Shown on the post and in link previews (WhatsApp, LinkedIn, X). 1200 × 630 PNG, JPG or WEBP, up to 900 KB.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex aspect-[1200/630] items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- public storage URL, previewed as uploaded
            <img src={url} alt={alt} className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground" aria-hidden />
          )}
        </div>
        <form action={action} className="flex flex-col gap-4">
          <fieldset disabled={!canEdit || pending} className="contents">
            <Field data-invalid={!!err.cover_image_alt}>
              <FieldLabel htmlFor="cover_image_alt">Alt text</FieldLabel>
              <Input id="cover_image_alt" name="cover_image_alt" defaultValue={alt} maxLength={200} required aria-invalid={!!err.cover_image_alt} placeholder="e.g. Tailwind CSS v5 logo on a dark background" />
              <FieldDescription>Describes the image for Google Images and screen readers.</FieldDescription>
              <FieldError>{err.cover_image_alt}</FieldError>
            </Field>
            {canEdit && (
              <div className="flex flex-wrap items-center gap-2">
                <FilePicker key={url ?? "none"} name="file" accept="image/png,image/jpeg,image/webp" required={!url} placeholder={url ? "Replace image (optional)" : "PNG, JPG or WEBP"} className="flex-1" />
                <Button type="submit" variant="outline" disabled={pending}>
                  <Upload /> {pending ? "Saving…" : url ? "Save" : "Upload"}
                </Button>
                {url && (
                  <ConfirmButton
                    action={removeCover.bind(null, postId)}
                    title="Remove cover image?"
                    description="The post will have no cover or link-preview image until you upload another."
                    confirmLabel="Remove"
                    successMessage="Cover removed"
                    variant="ghost"
                  >
                    Remove
                  </ConfirmButton>
                )}
              </div>
            )}
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}
