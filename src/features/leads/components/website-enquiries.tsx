import { getCurrentUser } from "@/features/auth/queries";
import { listNewWebsiteEnquiries } from "@/features/leads/queries";
import { EnquiriesBell } from "./enquiries-bell";

/** Bell for users who see leads; enquiries that arrived while nobody was signed in show here too (PRD §47). */
export async function WebsiteEnquiries() {
  const user = await getCurrentUser();
  if (!user?.permissions.includes("leads.view")) return null;
  const { rows, total } = await listNewWebsiteEnquiries().catch(() => ({ rows: [], total: 0 }));
  return <EnquiriesBell rows={rows} total={total} />;
}
