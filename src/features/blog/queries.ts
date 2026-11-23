import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { PAGE_SIZE } from "@/components/list-controls";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

type Db = SupabaseClient<Database>;

/** Public URL of a cover in the public `blog` bucket. */
export const coverUrl = (db: Db, path: string | null) => (path ? db.storage.from("blog").getPublicUrl(path).data.publicUrl : null);

// ───────────── ERP (signed-in user; `db` = another user client, e.g. the Claude connector's, PRD §48) ─────────────

export async function listCategories(db?: Db) {
  const supabase = db ?? (await createClient());
  const { data, error } = await supabase.from("blog_categories").select("id, name, slug, description, blog_posts(count)").order("name");
  if (error) throw error;
  return data.map(({ blog_posts, ...c }) => ({ ...c, posts: blog_posts[0]?.count ?? 0 }));
}

export async function listPosts({ q, page, category, status }: { q: string; page: number; category?: string; status?: string }, db?: Db) {
  const supabase = db ?? (await createClient());
  let query = supabase
    .from("blog_posts")
    .select("id, title, slug, status, published_at, updated_at, category_id, blog_categories(name)", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.ilike("title", `%${q}%`);
  if (category) query = query.eq("category_id", category);
  if (status) query = query.eq("status", status);
  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

export async function getPost(id: string, db?: Db) {
  const supabase = db ?? (await createClient());
  const { data, error } = await supabase.from("blog_posts").select("*, blog_categories(name, slug)").eq("id", id).maybeSingle();
  if (error) throw error;
  return data && { ...data, cover_url: coverUrl(supabase, data.cover_image_path) };
}

// ───────────── Website API (anon: RLS returns only published posts and public columns, PRD §49) ─────────────

const anon = () =>
  createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export async function publicCategories() {
  const { data, error } = await anon().from("blog_categories").select("name, slug, description").order("name");
  if (error) throw error;
  return data;
}

export async function publicPosts({ category, page }: { category: string; page: number }) {
  const db = anon();
  let query = db
    .from("blog_posts")
    .select("title, slug, excerpt, cover_image_path, cover_image_alt, published_at, updated_at, blog_categories!inner(name, slug)", { count: "exact" })
    .order("published_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (category) query = query.eq("blog_categories.slug", category);
  const { data, count, error } = await query;
  if (error) throw error;
  return {
    posts: data.map(({ cover_image_path, cover_image_alt, blog_categories, ...p }) => ({
      ...p,
      category: blog_categories,
      cover: cover_image_path ? { url: coverUrl(db, cover_image_path), alt: cover_image_alt } : null,
    })),
    page,
    page_size: PAGE_SIZE,
    total: count ?? 0,
  };
}

export async function publicPost(slug: string) {
  const db = anon();
  const { data, error } = await db
    .from("blog_posts")
    .select("title, slug, excerpt, content, cover_image_path, cover_image_alt, seo_title, meta_description, canonical_url, published_at, updated_at, blog_categories(name, slug)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { cover_image_path, cover_image_alt, seo_title, meta_description, canonical_url, blog_categories, ...p } = data;
  return {
    ...p,
    category: blog_categories,
    cover: cover_image_path ? { url: coverUrl(db, cover_image_path), alt: cover_image_alt } : null,
    // Fallbacks so the website can use these as-is for <title>, meta description and canonical.
    seo: { title: seo_title || p.title, description: meta_description || p.excerpt, canonical_url: canonical_url || null },
  };
}
