"use client";

import { useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { removeProof } from "@/features/payments/actions";
import { uploadProof } from "@/features/payments/upload";

type Proof = { id: string; file_name: string; size_bytes: number; url: string | null };


/** UPI screenshots, bank receipts… (PRD §20). Files go straight to Storage; the server then verifies and records them. */
export function ProofsCard(props: { paymentId: string; organizationId: string; proofs: Proof[]; canAdd: boolean; canRemove: boolean }) {
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    const result = await uploadProof(props.paymentId, props.organizationId, file);
    setBusy(false);
    if (input.current) input.current.value = "";
    if (result.error) toast.error(result.error);
    else toast.success("Proof added");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment proof</CardTitle>
        <CardDescription>UPI screenshot, bank receipt or confirmation. JPG, PNG, WEBP or PDF, up to 5 MB.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {props.proofs.length === 0 && <p className="text-sm text-muted-foreground">No files yet.</p>}
        {props.proofs.map((p) => (
          <div key={p.id} className="flex items-center gap-3 text-sm">
            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {p.url ? (
              <a href={p.url} target="_blank" rel="noreferrer" className="truncate hover:underline">
                {p.file_name}
              </a>
            ) : (
              <span className="truncate">{p.file_name}</span>
            )}
            <span className="shrink-0 text-muted-foreground tabular-nums">{Math.ceil(p.size_bytes / 1024)} KB</span>
            {props.canRemove && (
              <ConfirmButton
                action={removeProof.bind(null, props.paymentId, p.id)}
                title="Remove this file?"
                description="The file is deleted from storage."
                confirmLabel="Remove"
                successMessage="File removed"
                variant="ghost"
                size="sm"
              >
                Remove
              </ConfirmButton>
            )}
          </div>
        ))}
        {props.canAdd && (
          <div>
            {/* Hidden picker; the Upload button opens it. */}
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              aria-label="Proof file"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(file);
              }}
            />
            <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
              <Upload /> {busy ? "Uploading…" : "Upload"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
