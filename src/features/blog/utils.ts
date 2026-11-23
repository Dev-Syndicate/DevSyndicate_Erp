// Mirrors the slug CHECK in the blog migration.
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** "Tailwind CSS v5 — What's New?" → "tailwind-css-v5-whats-new" */
export function slugify(text: string) {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // accents split off by NFKD: é → e
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 100)
    .replace(/^-+|-+$/g, "");
}

/** Length Google shows before cutting off (guide only; Google measures pixels). */
export const SEO_TITLE_TARGET = 60;
export const META_DESCRIPTION_TARGET = 155;
