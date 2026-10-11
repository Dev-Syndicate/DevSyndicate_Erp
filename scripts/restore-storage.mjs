// Uploads backup/storage/<bucket>/… back into Storage (restore, docs/BACKUP.md). Buckets come from the database restore.
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
const headers = { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}) };
const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".pdf": "application/pdf" };

const root = join("backup", "storage");
let count = 0;
for (const file of readdirSync(root, { recursive: true, withFileTypes: true })) {
  if (!file.isFile()) continue;
  const full = join(file.parentPath, file.name);
  const [bucket, ...rest] = relative(root, full).split(sep);
  const path = rest.map(encodeURIComponent).join("/");
  const res = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: { ...headers, "x-upsert": "true", "Content-Type": TYPES[extname(full).toLowerCase()] ?? "application/octet-stream" },
    body: readFileSync(full),
  });
  if (!res.ok) throw new Error(`${bucket}/${rest.join("/")}: ${res.status} ${await res.text()}`);
  count++;
}
console.log(`Uploaded ${count} files`);
