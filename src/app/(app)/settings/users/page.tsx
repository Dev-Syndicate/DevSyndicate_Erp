import { Suspense } from "react";
import { Users } from "lucide-react";
import { EmptyRow } from "@/components/list-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/features/auth/queries";
import { EditUserDialog } from "@/features/users/components/edit-user-dialog";
import { InviteUserDialog } from "@/features/users/components/invite-user-dialog";
import { getAssignableRoles, listUsers } from "@/features/users/queries";

const signedIn = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

async function UsersList() {
  const me = await getCurrentUser();
  const can = (p: string) => !!me?.permissions.includes(p);
  const users = await listUsers();
  // Only a Super Admin may give the Super Admin role (the database enforces it; this just hides the option).
  const roles = await getAssignableRoles(users.some((u) => u.email === me?.email && u.role_key === "super_admin"));

  return (
    <>
      {can("users.create") && (
        <div className="flex justify-end">
          <InviteUserDialog roles={roles} />
        </div>
      )}
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 && <EmptyRow colSpan={6} icon={Users} title="No users" description="Invite your team to give them access." />}
              {users.map((u) => {
                const status = !u.is_active
                  ? { label: "Inactive", className: "bg-muted text-muted-foreground" }
                  : !u.last_sign_in_at
                    ? { label: "Invited", className: "bg-warning/15 text-warning" }
                    : { label: "Active", className: "bg-success/15 text-success" };
                const self = u.email === me?.email;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.full_name || "—"}
                      {self && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.role_name ?? <span className="text-muted-foreground">No role</span>}</TableCell>
                    <TableCell>
                      <Badge className={status.className}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">{u.last_sign_in_at ? signedIn.format(new Date(u.last_sign_in_at)) : "Never"}</TableCell>
                    <TableCell className="text-right">
                      {!self && (can("users.update") || can("users.deactivate")) && (
                        <EditUserDialog user={u} roles={roles} can={{ update: can("users.update"), deactivate: can("users.deactivate") }} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

export default function UsersPage() {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Users</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <UsersList />
      </Suspense>
    </>
  );
}
