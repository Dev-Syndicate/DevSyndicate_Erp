"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setActive } from "@/features/settings/actions";

type Props = { table: "tax_rates" | "expense_categories"; id: string; isActive: boolean };

export function ArchiveButton({ table, id, isActive }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setActive(table, id, !isActive);
          if (result.error) toast.error(result.error);
        })
      }
    >
      {isActive ? "Archive" : "Restore"}
    </Button>
  );
}
