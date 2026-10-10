"use client";

import { useTransition, type ComponentProps, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { downloadFile } from "@/lib/download";

type Props = {
  /** Server action (usually bound with its arguments). */
  action: () => Promise<{ ok?: boolean; error?: string }>;
  title: string;
  description: string;
  confirmLabel: string;
  successMessage?: string;
  /** File to download once the action succeeds, e.g. the PDF of a document that was just sent. */
  downloadOnSuccess?: string;
  children: ReactNode;
} & Pick<ComponentProps<typeof Button>, "variant" | "size" | "aria-label">;

/** Button that asks for confirmation, runs a server action and toasts the result. */
export function ConfirmButton({ action, title, description, confirmLabel, successMessage, downloadOnSuccess, children, ...button }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={pending} {...button}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              startTransition(async () => {
                const result = await action();
                if (result.error) toast.error(result.error);
                else {
                  if (successMessage) toast.success(successMessage);
                  if (downloadOnSuccess) downloadFile(downloadOnSuccess);
                }
              })
            }
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
