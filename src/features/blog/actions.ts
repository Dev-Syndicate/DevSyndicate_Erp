"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrors, type FormState } from "@/lib/forms";
import { IMAGE_MIME, imageType } from "@/lib/images";
import { createClient } from "@/lib/supabase/server";
import { categorySchema, postSchema, type PostStatus } from "./schema";

const NO_PERMISSION = "You don't have permission to do this.";
const LIVE = "Published posts can only be changed by someone who can publish.";
const SLUG_TAKEN = "Another one already uses this slug";
// Under the 1 MB server action body limit (Next.js default), leaving room for multipart overhead.
const MAX_IMAGE_BYTES = 900 * 1024;
const id = z.uuid();

// ───────────── Categories ─────────────

/** Creates a category, or updates it when `categoryId` is given. */
export async function saveCategory(categoryId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  if (categoryId && !id.safeParse(categoryId).success) return { error: "Invalid request." };
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data: organizationId } = await supabase.rpc("current_org_id");
  if (!organizationId) return { error: NO_PERMISSION };
  const { data, error } = categoryId
    ? await supabase.from("blog_categories").update(parsed.data).eq("id", categoryId).select("id")
    : await supabase.from("blog_categories").insert({ ...parsed.data, organization_id: organizationId }).select("id");
  if (error?.code === "23505") return { error: "Please fix the highlighted fields.", fieldErrors: { slug: SLUG_TAKEN } };
  if (error || !data.length) return { error: NO_PERMISSION };

  revalidatePath("/blog/categories");
  return { ok: true };
}

export async function deleteCategory(categoryId: string) {
  if (!id.safeParse(categoryId).success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("blog_categories").delete().eq("id", categoryId).select("id");
  if (error?.code === "23503") return { error: "This category has posts. Move them to another category first." };
  if (error || !data.length) return { error: NO_PERMISSION };
  revalidatePath("/blog/categories");
  return { ok: true };
}

// ───────────── Posts ─────────────

/** Creates a draft (then opens it for the cover image), or saves changes when `postId` is given. */
export async function savePost(postId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  if (postId && !id.safeParse(postId).success) return { error: "Invalid request." };
  const parsed = postSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  if (postId) {
    const { data, error } = await supabase.from("blog_posts").update(parsed.data).eq("id", postId).select("id");
    if (error?.code === "23505") return { error: "Please fix the highlighted fields.", fieldErrors: { slug: SLUG_TAKEN } };
    // RLS: a published post skips (0 rows) or rejects (42501) edits from someone without blog.publish.
    if (error && error.code !== "42501") return { error: NO_PERMISSION };
    if (!data?.length) return { error: LIVE };
    revalidatePath("/blog/posts");
    revalidatePath(`/blog/posts/${postId}`);
    return { ok: true };
  }

  const { data: organizationId } = await supabase.rpc("current_org_id");
  if (!organizationId) return { error: NO_PERMISSION };
  const { data, error } = await supabase.from("blog_posts").insert({ ...parsed.data, organization_id: organizationId }).select("id").single();
  if (error?.code === "23505") return { error: "Please fix the highlighted fields.", fieldErrors: { slug: SLUG_TAKEN } };
  if (error) return { error: NO_PERMISSION };
  revalidatePath("/blog/posts");
  redirect(`/blog/posts/${data.id}`);
}

export async function setPostStatus(postId: string, status: PostStatus) {
  if (!id.safeParse(postId).success || (status !== "draft" && status !== "published")) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("blog_posts").update({ status }).eq("id", postId).select("id");
  if (error || !data.length) return { error: "You don't have permission to publish or unpublish posts." };
  revalidatePath("/blog/posts");
  revalidatePath(`/blog/posts/${postId}`);
  return { ok: true };
}

export async function deletePost(postId: string) {
  if (!id.safeParse(postId).success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("blog_posts").delete().eq("id", postId).select("cover_image_path");
  if (error || !data.length) return { error: NO_PERMISSION };
  if (data[0].cover_image_path) await supabase.storage.from("blog").remove([data[0].cover_image_path]);
  revalidatePath("/blog/posts");
  redirect("/blog/posts");
}

// ───────────── Cover image ─────────────

/** Saves the cover's alt text, and uploads a new cover when a file is chosen (PNG, JPG or WEBP). */
export async function saveCover(postId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!id.safeParse(postId).success) return { error: "Invalid request." };
  const alt = z.string().trim().min(1, "Describe the image for search engines and screen readers").max(200).safeParse(formData.get("cover_image_alt") ?? "");
  if (!alt.success) return { error: "Please fix the highlighted fields.", fieldErrors: { cover_image_alt: alt.error.issues[0].message } };
  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;

  const supabase = await createClient();
  const { data: post } = await supabase.from("blog_posts").select("organization_id, cover_image_path").eq("id", postId).maybeSingle();
  if (!post) return { error: NO_PERMISSION };
  if (!hasFile) {
    if (!post.cover_image_path) return { error: "Choose an image." };
    const { data, error } = await supabase.from("blog_posts").update({ cover_image_alt: alt.data }).eq("id", postId).select("id");
    if (error || !data.length) return { error: LIVE };
    revalidatePath(`/blog/posts/${postId}`);
    return { ok: true };
  }

  if (file.size > MAX_IMAGE_BYTES) return { error: "Images can be up to 900 KB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = imageType(bytes);
  if (!type) return { error: "Use a PNG, JPG or WEBP image." };
  // New name per upload, so cached copies of the old image never show.
  const path = `${post.organization_id}/${postId}-${Date.now()}.${type}`;
  const upload = await supabase.storage.from("blog").upload(path, bytes, { contentType: IMAGE_MIME[type] });
  if (upload.error) return { error: NO_PERMISSION };

  const { data, error } = await supabase.from("blog_posts").update({ cover_image_path: path, cover_image_alt: alt.data }).eq("id", postId).select("id");
  if (error || !data.length) {
    await supabase.storage.from("blog").remove([path]);
    return { error: LIVE };
  }
  if (post.cover_image_path) await supabase.storage.from("blog").remove([post.cover_image_path]);
  revalidatePath(`/blog/posts/${postId}`);
  return { ok: true };
}

export async function removeCover(postId: string) {
  if (!id.safeParse(postId).success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data: post } = await supabase.from("blog_posts").select("cover_image_path").eq("id", postId).maybeSingle();
  const { data, error } = await supabase.from("blog_posts").update({ cover_image_path: null, cover_image_alt: "" }).eq("id", postId).select("id");
  if (error || !data.length) return { error: LIVE };
  if (post?.cover_image_path) await supabase.storage.from("blog").remove([post.cover_image_path]);
  revalidatePath(`/blog/posts/${postId}`);
  return { ok: true };
}
