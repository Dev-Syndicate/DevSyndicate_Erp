import type { DocumentEntity } from "@/lib/documents/actions";
import { createClient } from "@/lib/supabase/server";

/** Files attached to a record, with short-lived signed URLs (private `documents` bucket). */
export async function getDocuments(entityType: DocumentEntity, entityId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, path, file_name, mime_type, size_bytes, created_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at");
  if (error) throw error;
  if (!data.length) return [];
  const { data: urls } = await supabase.storage.from("documents").createSignedUrls(data.map((d) => d.path), 3600);
  return data.map((d, i) => ({ ...d, url: urls?.[i]?.signedUrl ?? null }));
}
