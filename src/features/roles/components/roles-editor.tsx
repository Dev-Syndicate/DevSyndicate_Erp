"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRole, deleteRole, setPermission } from "@/features/roles/actions";

type Role = { id: string; key: string; name: string; is_system: boolean; permissions: string[] };

const MODULES: Record<string, string> = {
  dashboard: "Dashboard", clients: "Clients", leads: "Leads", vendors: "Vendors", quotations: "Quotations", invoices: "Invoices",
  credit_notes: "Credit notes", payments: "Payments", expenses: "Expenses", owner: "Owner's account", documents: "Documents", reports: "Reports",
  data: "Data import", users: "Users", roles: "Roles", settings: "Settings", audit_logs: "Audit logs",
};
const ACTIONS: Record<string, string> = { create: "Create", update: "Edit", delete: "Delete", deactivate: "Deactivate", manage: "Manage", import: "Import" };
const actionLabel = (a: string) => ACTIONS[a] ?? a.charAt(0).toUpperCase() + a.slice(1);

/** Permission checkboxes per role, grouped by module (PRD §5). Changes save immediately and apply on the next page load. */
export function RolesEditor({ roles, permissions, canManage }: { roles: Role[]; permissions: string[]; canManage: boolean }) {
  const [selected, setSelected] = useState<string | undefined>(roles[0]?.id);
  const [newName, setNewName] = useState("");
  const [pending, startTransition] = useTransition();
  const role = roles.find((r) => r.id === selected) ?? roles[0];
  const [granted, toggle] = useOptimistic(new Set(role?.permissions), (set: Set<string>, change: { key: string; on: boolean }) => {
    const next = new Set(set);
    if (change.on) next.add(change.key);
    else next.delete(change.key);
    return next;
  });
  const locked = role?.key === "super_admin";
  const modules = [...new Set(permissions.map((p) => p.split(".")[0]))];

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {roles.map((r) => (
            <Button key={r.id} variant={r.id === role?.id ? "secondary" : "ghost"} className="justify-between" onClick={() => setSelected(r.id)}>
              {r.name}
              <span className="text-xs text-muted-foreground tabular-nums">{r.key === "super_admin" ? "all" : r.permissions.length}</span>
            </Button>
          ))}
          {canManage && (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  const result = await createRole(newName);
                  if (result.error) toast.error(result.error);
                  else {
                    setNewName("");
                    setSelected(result.id);
                    toast.success("Role created. Tick what it may do.");
                  }
                });
              }}
            >
              <Input aria-label="New role name" placeholder="New role" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Button type="submit" variant="outline" size="icon" aria-label="Create role" disabled={pending || !newName.trim()}>
                <Plus />
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {role && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {role.name} {role.is_system && <Badge variant="outline">Built-in</Badge>}
            </CardTitle>
            <CardDescription>
              {locked
                ? "The Super Admin role always has every permission and can't be changed."
                : canManage
                  ? "Tick what users with this role may do. Changes save straight away."
                  : "Only a Super Admin can change permissions."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {modules.map((m) => (
              <div key={m} className="grid gap-2 border-b pb-4 last:border-0 sm:grid-cols-[10rem_1fr]">
                <span className="text-sm font-medium">{MODULES[m] ?? m}</span>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {permissions
                    .filter((p) => p.startsWith(`${m}.`))
                    .map((p) => (
                      <div key={p} className="flex items-center gap-2">
                        <Checkbox
                          id={`${role.id}-${p}`}
                          checked={locked || granted.has(p)}
                          disabled={locked || !canManage}
                          onCheckedChange={(v) =>
                            startTransition(async () => {
                              toggle({ key: p, on: v === true });
                              const result = await setPermission(role.id, p, v === true);
                              if (result.error) toast.error(result.error);
                            })
                          }
                        />
                        <Label htmlFor={`${role.id}-${p}`} className="font-normal">
                          {actionLabel(p.split(".")[1])}
                        </Label>
                      </div>
                    ))}
                </div>
              </div>
            ))}
            {canManage && !role.is_system && (
              <div>
                <ConfirmButton
                  action={deleteRole.bind(null, role.id)}
                  title={`Delete the ${role.name} role?`}
                  description="Only possible when no user has this role."
                  confirmLabel="Delete role"
                  successMessage="Role deleted"
                  variant="outline"
                >
                  <Trash2 /> Delete role
                </ConfirmButton>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
