import { addProof } from "@/features/payments/actions";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Uploads a proof file straight to Storage (server actions cap bodies at 1 MB, PRD §20), then asks the server
 * to verify and record it. Browser only.
 */
export async function uploadProof(paymentId: string, organizationId: string, file: File): Promise<{ error?: string }> {
  if (file.size > MAX_BYTES) return { error: "Files can be up to 5 MB." };
  const safeName = file.name.replace(/[^\w.-]+/g, "-").slice(-80);
  const path = `${organizationId}/payment/${paymentId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await createClient().storage.from("documents").upload(path, file, { contentType: file.type });
  if (error) return { error: "Upload failed. Use a JPG, PNG, WEBP or PDF up to 5 MB." };
  return addProof(paymentId, path, file.name);
}
