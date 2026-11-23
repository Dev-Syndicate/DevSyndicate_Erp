import { getNotifications } from "@/features/notifications/queries";
import { NotificationsBell } from "./notifications-bell";

/** Server part of the top-bar bell: loads the user's notifications on each page load (PRD §50). */
export async function Notifications() {
  const data = await getNotifications().catch(() => null);
  return data && <NotificationsBell rows={data.rows} unread={data.unread} />;
}
