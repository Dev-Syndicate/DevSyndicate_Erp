"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { issuesByPath } from "@/components/document-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveOwnerTransaction } from "@/features/owner/actions";
import { OWNER_KINDS, ownerTransactionSchema, type OwnerTransactionInput } from "@/features/owner/schema";
import { istToday } from "@/lib/dates";
import { uploadDocument } from "@/lib/documents/upload";
import { METHODS, referenceLabel } from "@/lib/payment-methods";
import type { Tables } from "@/lib/supabase/database.types";

type Props = {
  organizationId: string;
  transaction?: Tables<"owner_transactions">;
  /** Files already attached (edit). */
  proofs?: { id: string; file_name: string; size_bytes: number; url: string | null }[];
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export function OwnerForm({ organizationId, transaction, proofs = [] }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<OwnerTransactionInput>(() => ({
    kind: (transaction?.kind as OwnerTransactionInput["kind"]) ?? "drawing",
    txn_date: transaction?.txn_date ?? istToday(),
    amount: transaction ? String(transaction.amount) : "",
    method: (transaction?.method as OwnerTransactionInput["method"]) ?? "cash",
    reference: transaction?.reference ?? "",
    notes: transaction?.notes ?? "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  // Files picked here upload once the transaction is saved (they need its id).
  const [files, setFiles] = useState<File[]>([]);
  const picker = useRef<HTMLInputElement>(null);

  const set = <K extends keyof OwnerTransactionInput>(name: K, value: OwnerTransactionInput[K]) => setForm((f) => ({ ...f, [name]: value }));
  const err = (k: string) => errors[k];
  const ref = referenceLabel(form.method);

  function submit() {
    const parsed = ownerTransactionSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(issuesByPath(parsed.error.issues));
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await saveOwnerTransaction(transaction?.id ?? null, form);
      if (!result.id) {
        toast.error(result.error ?? "Something went wrong. Please try again.");
        return;
      }
      for (const file of files) {
        const upload = await uploadDocument("owner", result.id, organizationId, file);
        if (upload.error) toast.error(`${file.name}: ${upload.error}`);
      }
      router.push(`/finance/owner/${result.id}`);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-6"
    >
      <fieldset disabled={pending} className="contents">
        <Card>
          <CardHeader>
            <CardTitle>Transaction</CardTitle>
            <CardDescription>Changes your capital and the company balance, never expenses or profit.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="kind">Type</FieldLabel>
                <Select value={form.kind} onValueChange={(v) => set("kind", v as OwnerTransactionInput["kind"])}>
                  <SelectTrigger id="kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OWNER_KINDS.map((k) => (
                      <SelectItem key={k.value} value={k.value}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>{OWNER_KINDS.find((k) => k.value === form.kind)?.hint}</FieldDescription>
              </Field>
              <Field data-invalid={!!err("txn_date")}>
                <FieldLabel htmlFor="txn_date">Date</FieldLabel>
                <Input id="txn_date" type="date" value={form.txn_date} max={istToday()} onChange={(e) => set("txn_date", e.target.value)} aria-invalid={!!err("txn_date")} />
                <FieldError>{err("txn_date")}</FieldError>
              </Field>
              <Field data-invalid={!!err("amount")}>
                <FieldLabel htmlFor="amount">Amount (₹)</FieldLabel>
                <Input id="amount" value={form.amount} onChange={(e) => set("amount", e.target.value)} inputMode="decimal" placeholder="0.00" className="tabular-nums" aria-invalid={!!err("amount")} />
                <FieldError>{err("amount")}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="method">Method</FieldLabel>
                <Select value={form.method} onValueChange={(v) => set("method", v as OwnerTransactionInput["method"])}>
                  <SelectTrigger id="method" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {ref && (
                <Field data-invalid={!!err("reference")}>
                  <FieldLabel htmlFor="reference">{ref.label}</FieldLabel>
                  <Input id="reference" value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder={`Optional, e.g. ${ref.example}`} />
                  <FieldError>{err("reference")}</FieldError>
                </Field>
              )}
              <Field className="sm:col-span-2 lg:col-span-4">
                <FieldLabel htmlFor="notes">Notes</FieldLabel>
                <Textarea id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Proof</CardTitle>
            <CardDescription>A payment screenshot, ATM slip or bank statement line. JPG, PNG, WEBP or PDF, up to 5 MB each.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {proofs.map((p) => (
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
              </div>
            ))}
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="flex items-center gap-3 text-sm">
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">{Math.ceil(f.size / 1024)} KB · uploads on save</span>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${f.name}`} onClick={() => setFiles((l) => l.filter((_, j) => j !== i))}>
                  <X />
                </Button>
              </div>
            ))}
            <div>
              {/* Hidden picker; the button opens it. */}
              <input
                ref={picker}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                aria-label="Proof file"
                className="hidden"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  const tooBig = picked.filter((f) => f.size > MAX_FILE_BYTES);
                  if (tooBig.length) toast.error(`Files can be up to 5 MB: ${tooBig.map((f) => f.name).join(", ")}`);
                  setFiles((l) => [...l, ...picked.filter((f) => f.size <= MAX_FILE_BYTES)]);
                  e.target.value = "";
                }}
              />
              <Button type="button" variant="outline" onClick={() => picker.current?.click()}>
                <Upload /> Add file
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" asChild>
            <Link href={transaction ? `/finance/owner/${transaction.id}` : "/finance/owner"}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : transaction ? "Save" : "Record"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
