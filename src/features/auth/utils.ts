// No path-alias imports: utils.test.mjs runs this file directly with `node --test`.

/** Same-site path to return to after signing in; anything else (another host, "//x", "/\x") goes home. */
export function safeNext(next: string): string {
  return next.startsWith("/") && next[1] !== "/" && next[1] !== "\\" ? next : "/";
}
