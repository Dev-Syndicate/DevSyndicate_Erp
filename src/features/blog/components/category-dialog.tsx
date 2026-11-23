"use client";

import { useActionState, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveCategory } from "@/features/blog/actions";
import { slugify } from "@/features/blog/utils";
import type { FormState } from "@/lib/forms";

type Category = { id: string; name: string; slug: string; description: string };

/** Add or edit a category. The slug follows the name until edited (new categories only). */
export function CategoryDialog({ category, children }: { category?: Category; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!category);
  const [state, action, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await saveCategory(category?.id ?? null, prev, formData);
    if (result.ok) {
      toast.success(category ? "Category saved" : "Category added");
      setOpen(false);
      if (!category) {
        setName("");
        setSlug("");
        setSlugTouched(false);
      }
    } else if (result.error) toast.error(result.error);
    return result;
  }, {});
  const err = state.fieldErrors ?? {};
  const prefix = category?.id ?? "new";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <form action={action} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle>
            <DialogDescription>Categories group posts on the website, e.g. Tech News or Company News.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!err.name}>
              <FieldLabel htmlFor={`${prefix}-name`}>Name</FieldLabel>
              <Input
                id={`${prefix}-name`}
                name="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
                maxLength={80}
                required
                aria-invalid={!!err.name}
              />
              <FieldError>{err.name}</FieldError>
            </Field>
            <Field data-invalid={!!err.slug}>
              <FieldLabel htmlFor={`${prefix}-slug`}>Slug</FieldLabel>
              <Input
                id={`${prefix}-slug`}
                name="slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
                maxLength={100}
                className="font-mono"
                aria-invalid={!!err.slug}
              />
              <FieldDescription>Used in the website address: /blog/{slug || "slug"}. Changing it breaks old links.</FieldDescription>
              <FieldError>{err.slug}</FieldError>
            </Field>
            <Field data-invalid={!!err.description}>
              <FieldLabel htmlFor={`${prefix}-description`}>Description</FieldLabel>
              <Textarea id={`${prefix}-description`} name="description" defaultValue={category?.description} maxLength={500} rows={3} />
              <FieldDescription>Optional. The website can show it on the category page.</FieldDescription>
              <FieldError>{err.description}</FieldError>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : category ? "Save" : "Add category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
