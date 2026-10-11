import "server-only";

/** Sends one email through Resend from the verified devsyndicate.in domain (PRD §6). Never throws. */
export async function sendEmail(to: string, subject: string, html: string): Promise<{ error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { error: "Email is not set up (RESEND_API_KEY)." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "DevSyndicate ERP <noreply@devsyndicate.in>", to: [to], subject, html }),
    });
    return res.ok ? {} : { error: "The email could not be sent." };
  } catch {
    return { error: "The email could not be sent." };
  }
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);
