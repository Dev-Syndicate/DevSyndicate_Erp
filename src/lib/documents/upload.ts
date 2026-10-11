import { addDocument, type DocumentEntity } from "@/lib/documents/actions";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Uploads a file straight to Storage (server actions cap bodies at 1 MB, PRD §20), then asks the server
 * to verify and record it. Browser only.
 */
export async function uploadDocument(entityType: DocumentEntity, entityId: string, organizationId: string, file: File): Promise<{ error?: string }> {
  if (file.size > MAX_BYTES) return { error: "Files can be up to 5 MB." };
  const safeName = file.name.replace(/[^\w.-]+/g, "-").slice(-80);
  const path = `${organizationId}/${entityType}/${entityId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await createClient().storage.from("documents").upload(path, file, { contentType: file.type });
  if (error) return { error: "Upload failed. Use a JPG, PNG, WEBP or PDF up to 5 MB." };
  return addDocument(entityType, entityId, path, file.name);
}
