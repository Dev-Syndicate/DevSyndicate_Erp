"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { decideAuthorization } from "@/features/auth/actions";

/** Approve / deny buttons for the Claude connector consent page (PRD §48). Success redirects back to Claude. */
export function ConsentForm({ authorizationId }: { authorizationId: string }) {
  const [pending, startTransition] = useTransition();
  const decide = (approve: boolean) =>
    startTransition(async () => {
      const result = await decideAuthorization(authorizationId, approve);
      if (result?.error) toast.error(result.error);
    });

  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" disabled={pending} onClick={() => decide(false)}>
        Deny
      </Button>
      <Button disabled={pending} onClick={() => decide(true)}>
        {pending ? "Connecting…" : "Allow"}
      </Button>
    </div>
  );
}
