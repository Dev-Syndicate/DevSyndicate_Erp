"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { savePost } from "@/features/blog/actions";
import { META_DESCRIPTION_TARGET, SEO_TITLE_TARGET, slugify } from "@/features/blog/utils";
import type { FormState } from "@/lib/forms";
import type { Tables } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "./rich-text-editor";

type Props = { post?: Tables<"blog_posts">; categories: { id: string; name: string }[]; readOnly?: boolean };

/** "42 / 60": turns warning once Google would likely cut the text off. */
function Counter({ length, target }: { length: number; target: number }) {
  return <span className={cn("tabular-nums", length > target && "text-warning")}>{length} / {target}</span>;
}

export function PostForm({ post, categories, readOnly = false }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePost.bind(null, post?.id ?? null), {});
  const err = state.fieldErrors ?? {};
  const [title, setTitle] = useState(post?.title ?? "");
  // New posts: the slug follows the title until someone edits it.
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!post);
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [seoTitle, setSeoTitle] = useState(post?.seo_title ?? "");
  const [metaDescription, setMetaDescription] = useState(post?.meta_description ?? "");

  useEffect(() => {
    if (state.ok) toast.success("Post saved");
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="flex flex-col gap-6">
      <fieldset disabled={readOnly || pending} className="contents">
        <Card>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!err.title} className="col-span-full">
                <FieldLabel htmlFor="title">Title</FieldLabel>
                <Input
                  id="title"
                  name="title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!slugTouched) setSlug(slugify(e.target.value));
                  }}
                  maxLength={200}
                  required
                  aria-invalid={!!err.title}
                />
                <FieldError>{err.title}</FieldError>
              </Field>
              <Field data-invalid={!!err.slug}>
                <FieldLabel htmlFor="slug">Slug</FieldLabel>
                <Input
                  id="slug"
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
                <FieldDescription>The post&apos;s web address: /blog/category/{slug || "slug"}. Changing it after publishing breaks old links.</FieldDescription>
                <FieldError>{err.slug}</FieldError>
              </Field>
              <Field data-invalid={!!err.category_id}>
                <FieldLabel htmlFor="category_id">Category</FieldLabel>
                <Select name="category_id" defaultValue={post?.category_id} required>
                  <SelectTrigger id="category_id" className="w-full" aria-invalid={!!err.category_id}>
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {categories.length === 0 && (
                  <FieldDescription>
                    No categories yet. <Link href="/blog/categories" className="underline">Add one first</Link>.
                  </FieldDescription>
                )}
                <FieldError>{err.category_id}</FieldError>
              </Field>
              <Field data-invalid={!!err.excerpt} className="col-span-full">
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="excerpt">Excerpt</FieldLabel>
                  <FieldDescription><Counter length={excerpt.length} target={300} /></FieldDescription>
                </div>
                <Textarea id="excerpt" name="excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} maxLength={300} rows={2} aria-invalid={!!err.excerpt} />
                <FieldDescription>Short summary for blog cards. Also used as the meta description when that is empty.</FieldDescription>
                <FieldError>{err.excerpt}</FieldError>
              </Field>
              <Field data-invalid={!!err.content} className="col-span-full">
                <FieldLabel htmlFor="content">Content</FieldLabel>
                <RichTextEditor id="content" name="content" defaultValue={post?.content ?? ""} disabled={readOnly} invalid={!!err.content} />
                <FieldError>{err.content}</FieldError>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Search engine (SEO)</CardTitle>
            <CardDescription>How the post appears on Google and in link previews. Empty fields fall back to the title and excerpt.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4">
              <Field data-invalid={!!err.seo_title}>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="seo_title">SEO title</FieldLabel>
                  <FieldDescription><Counter length={seoTitle.length} target={SEO_TITLE_TARGET} /></FieldDescription>
                </div>
                <Input id="seo_title" name="seo_title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={100} placeholder={title} aria-invalid={!!err.seo_title} />
                <FieldError>{err.seo_title}</FieldError>
              </Field>
              <Field data-invalid={!!err.meta_description}>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="meta_description">Meta description</FieldLabel>
                  <FieldDescription><Counter length={metaDescription.length} target={META_DESCRIPTION_TARGET} /></FieldDescription>
                </div>
                <Textarea
                  id="meta_description"
                  name="meta_description"
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  maxLength={300}
                  rows={2}
                  placeholder={excerpt}
                  aria-invalid={!!err.meta_description}
                />
                <FieldError>{err.meta_description}</FieldError>
              </Field>
              <Field data-invalid={!!err.canonical_url}>
                <FieldLabel htmlFor="canonical_url">Canonical URL</FieldLabel>
                <Input id="canonical_url" name="canonical_url" type="url" defaultValue={post?.canonical_url} placeholder="https://…" aria-invalid={!!err.canonical_url} />
                <FieldDescription>Only if this post was first published on another site. Leave empty otherwise.</FieldDescription>
                <FieldError>{err.canonical_url}</FieldError>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      </fieldset>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/blog/posts">{readOnly ? "Back" : "Cancel"}</Link>
        </Button>
        {!readOnly && (
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : post ? "Save changes" : "Create draft"}
          </Button>
        )}
      </div>
    </form>
  );
}
