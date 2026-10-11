import { Suspense } from "react";
import { ListSkeleton } from "@/components/page-skeletons";
import { getCurrentUser } from "@/features/auth/queries";
import { RolesEditor } from "@/features/roles/components/roles-editor";
import { getRolesWithPermissions } from "@/features/roles/queries";

async function Roles() {
  const [user, { roles, permissions }] = await Promise.all([getCurrentUser(), getRolesWithPermissions()]);
  return <RolesEditor roles={roles} permissions={permissions} canManage={!!user?.permissions.includes("roles.manage")} />;
}

export default function RolesPage() {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Roles &amp; permissions</h1>
      <Suspense fallback={<ListSkeleton />}>
        <Roles />
      </Suspense>
    </>
  );
}
