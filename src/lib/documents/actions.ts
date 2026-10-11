"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

export type DocumentEntity = "payment" | "expense";

const id = z.uuid();
const entity = z.enum(["payment", "expense"]);
const MAX_BYTES = 5 * 1024 * 1024;
const PAGES: Record<DocumentEntity, string> = { payment: "/finance/payments", expense: "/finance/expenses" };

/** JPG, PNG, WEBP or PDF by file signature, not by name or browser-reported type (PRD §26). */
function fileType(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  if (String.fromCharCode(...b.slice(0, 5)) === "%PDF-") return "application/pdf";
  return null;
}

/**
 * Records a file the browser already uploaded to `<org>/<entity>/<record id>/…` (PRD §20, §26).
 * Re-checks the file on the server; anything that isn't a real JPG/PNG/WEBP/PDF under 5 MB is deleted.
 */
export async function addDocument(entityType: DocumentEntity, entityId: string, path: string, fileName: string): Promise<FormState> {
  if (!entity.safeParse(entityType).success || !id.safeParse(entityId).success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data: org } = await supabase.rpc("current_org_id");
  if (!org || !path.startsWith(`${org}/${entityType}/${entityId}/`) || path.includes("..")) return { error: "Invalid request." };

  const { data: blob } = await supabase.storage.from("documents").download(path);
  const bytes = blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  const type = bytes && bytes.length <= MAX_BYTES ? fileType(bytes) : null;
  if (!bytes || !type) {
    await supabase.storage.from("documents").remove([path]);
    return { error: "Use a JPG, PNG, WEBP or PDF file up to 5 MB." };
  }

  const { error } = await supabase.from("documents").insert({
    organization_id: org,
    entity_type: entityType,
    entity_id: entityId,
    path,
    file_name: fileName.slice(0, 200),
    mime_type: type,
    size_bytes: bytes.length,
  });
  if (error) {
    await supabase.storage.from("documents").remove([path]);
    return { error: "You don't have permission to do this." };
  }
  revalidatePath(`${PAGES[entityType]}/${entityId}`);
  return { ok: true };
}

export async function removeDocument(entityType: DocumentEntity, entityId: string, documentId: string): Promise<FormState> {
  if (!entity.safeParse(entityType).success || !id.safeParse(entityId).success || !id.safeParse(documentId).success) {
    return { error: "Invalid request." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("documents").delete().eq("id", documentId).eq("entity_id", entityId).select("path");
  if (error || !data.length) return { error: "You don't have permission to do this." };
  await supabase.storage.from("documents").remove([data[0].path]);
  revalidatePath(`${PAGES[entityType]}/${entityId}`);
  return { ok: true };
}
