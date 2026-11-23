import sanitizeHtml from "sanitize-html";

/** Rich-text HTML with only structural tags: no styles, classes or scripts, so the website styles it (PRD §49). */
export function cleanHtml(html: string) {
  const clean = sanitizeHtml(html, {
    allowedTags: ["p", "br", "h2", "h3", "h4", "strong", "em", "u", "s", "a", "ul", "ol", "li", "blockquote", "code", "pre", "hr"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
  }).trim();
  // An empty editor still sends "<p></p>".
  return clean.replace(/<p><\/p>/g, "") === "" ? "" : clean;
}
