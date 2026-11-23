import { z } from "zod";
import { cleanHtml } from "./html";
import { SLUG_RE, slugify } from "./utils";

// Mirror the CHECK constraints in the blog migration (PRD §49).
const slug = z.string().trim().toLowerCase().max(100);
const slugMessage = { path: ["slug"], message: "Use lowercase letters, numbers and dashes" };
/** Empty slug = made from the name or title. */
const withSlug = <T extends { slug: string }>(from: (v: T) => string) => (v: T) => ({ ...v, slug: v.slug || slugify(from(v)) });

export const categorySchema = z
  .object({
    name: z.string().trim().min(1, "Required").max(80),
    slug,
    description: z.string().trim().max(500),
  })
  .transform(withSlug((c) => c.name))
  .refine((c) => SLUG_RE.test(c.slug), slugMessage);

export const postSchema = z
  .object({
    title: z.string().trim().min(1, "Required").max(200),
    slug,
    category_id: z.uuid("Choose a category"),
    excerpt: z.string().trim().max(300, "Up to 300 characters"),
    content: z.string().max(200000, "The post is too long").transform(cleanHtml),
    seo_title: z.string().trim().max(100, "Up to 100 characters"),
    meta_description: z.string().trim().max(300, "Up to 300 characters"),
    canonical_url: z.union([z.literal(""), z.url({ protocol: /^https?$/, message: "Use a full https:// link" }).max(500)]),
  })
  .transform(withSlug((p) => p.title))
  .refine((p) => SLUG_RE.test(p.slug), slugMessage);

export type PostInput = z.input<typeof postSchema>;

export const POST_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
] as const;
export type PostStatus = (typeof POST_STATUSES)[number]["value"];
