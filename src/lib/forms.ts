import { z } from "zod";

export type FormState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

/** First error message per field, for showing under inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    out[key] ??= issue.message;
  }
  return out;
}

// Mirror the CHECK constraints in the migrations.
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PIN_RE = /^[1-9][0-9]{5}$/;

/** Upper-cased code field where empty string means "not set". */
export const optionalCode = (re: RegExp, message: string) =>
  z.string().trim().toUpperCase().refine((v) => v === "" || re.test(v), message);
