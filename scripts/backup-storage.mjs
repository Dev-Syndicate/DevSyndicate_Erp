// Downloads every Storage file (logo, signature, payment proofs, expense receipts) into backup/storage/<bucket>/…
// Backup job only (PRD §34): uses the service-role key, which never reaches user-facing code (§32.3).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");

// New secret keys (sb_secret_…) go in the apikey header only; legacy service_role JWTs also as a bearer token.
const headers = { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}) };

async function api(path, init) {
  const res = await fetch(`${url}/storage/v1/${path}`, { ...init, headers: { ...headers, ...init?.headers } });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res;
}

/** Every file path in a bucket (folders are entries without an id). */
async function listAll(bucket, prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await api(`object/list/${bucket}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: 1000, offset }),
    });
    const entries = await res.json();
    for (const e of entries) {
      const path = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.id) files.push(path);
      else files.push(...(await listAll(bucket, path)));
    }
    if (entries.length < 1000) return files;
  }
}

let count = 0;
for (const bucket of await (await api("bucket")).json()) {
  for (const path of await listAll(bucket.id)) {
    const res = await api(`object/${bucket.id}/${path.split("/").map(encodeURIComponent).join("/")}`);
    const out = join("backup", "storage", bucket.id, path);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    count++;
  }
}
console.log(`Downloaded ${count} files`);
