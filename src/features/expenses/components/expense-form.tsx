"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { issuesByPath } from "@/components/document-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/date-picker";
import { saveExpense } from "@/features/expenses/actions";
import { expenseSchema, type ExpenseInput } from "@/features/expenses/schema";
import { istToday } from "@/lib/dates";
import { uploadDocument } from "@/lib/documents/upload";
import { formatINR, toScaled } from "@/lib/money";
import { METHODS, referenceLabel } from "@/lib/payment-methods";
import type { Tables } from "@/lib/supabase/database.types";

type Category = { id: string; name: string };
type Vendor = { id: string; name: string; default_expense_category_id: string | null };

type Props = {
  categories: Category[];
  vendors: Vendor[];
  gstRegistered: boolean;
  organizationId: string;
  expense?: Tables<"expenses">;
  /** Files already attached (edit). */
  receipts?: { id: string; file_name: string; size_bytes: number; url: string | null }[];
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const NO_VENDOR = "none"; // Select items can't have an empty value
const scaled = (v: string) => toScaled(v || "0", 2) ?? 0n;

export function ExpenseForm({ categories, vendors, gstRegistered, organizationId, expense, receipts = [] }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ExpenseInput>(() => ({
    expense_date: expense?.expense_date ?? istToday(),
    category_id: expense?.category_id ?? "",
    vendor_id: expense?.vendor_id ?? "",
    description: expense?.description ?? "",
    vendor_invoice_number: expense?.vendor_invoice_number ?? "",
    amount: expense ? String(expense.amount) : "",
    gst_amount: String(expense?.gst_amount ?? 0),
    itc_eligible: expense?.itc_eligible ?? false,
    reverse_charge: expense?.reverse_charge ?? false,
    tds_amount: String(expense?.tds_amount ?? 0),
    method: (expense?.method as ExpenseInput["method"]) ?? "bank_transfer",
    reference: expense?.reference ?? "",
    notes: expense?.notes ?? "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  // Bill / receipt files picked here; uploaded once the expense is saved (they need its id).
  const [files, setFiles] = useState<File[]>([]);
  const picker = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ExpenseInput>(name: K, value: ExpenseInput[K]) => setForm((f) => ({ ...f, [name]: value }));
  const err = (k: string) => errors[k];
  const ref = referenceLabel(form.method);
  const hasGst = gstRegistered && scaled(form.gst_amount) > 0n;
  const tds = scaled(form.tds_amount);

  function chooseVendor(value: string) {
    const vendor = vendors.find((v) => v.id === value);
    const usual = categories.find((c) => c.id === vendor?.default_expense_category_id)?.id;
    // The vendor's usual category, unless one is already chosen.
    setForm((f) => ({ ...f, vendor_id: vendor?.id ?? "", category_id: f.category_id || usual || "" }));
  }

  function submit() {
    const input: ExpenseInput = {
      ...form,
      gst_amount: gstRegistered ? form.gst_amount || "0" : "0",
      tds_amount: form.tds_amount || "0",
      itc_eligible: hasGst && form.itc_eligible,
      reverse_charge: hasGst && form.reverse_charge,
    };
    const parsed = expenseSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(issuesByPath(parsed.error.issues));
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await saveExpense(expense?.id ?? null, input);
      if (!result.id) {
        toast.error(result.error ?? "Something went wrong. Please try again.");
        return;
      }
      for (const file of files) {
        const upload = await uploadDocument("expense", result.id, organizationId, file);
        if (upload.error) toast.error(`${file.name}: ${upload.error}`);
      }
      router.push(`/finance/expenses/${result.id}`);
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
            <CardTitle>Expense</CardTitle>
            <CardDescription>Record it when the money is paid.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field data-invalid={!!err("expense_date")}>
                <FieldLabel htmlFor="expense_date">Date paid</FieldLabel>
                <DatePicker id="expense_date" value={form.expense_date} max={istToday()} onChange={(v) => set("expense_date", v)} aria-invalid={!!err("expense_date")} />
                <FieldError>{err("expense_date")}</FieldError>
              </Field>
              <Field data-invalid={!!err("category_id")}>
                <FieldLabel htmlFor="category_id">Category</FieldLabel>
                <Select value={form.category_id} onValueChange={(v) => set("category_id", v)}>
                  <SelectTrigger id="category_id" className="w-full" aria-invalid={!!err("category_id")}>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError>{err("category_id")}</FieldError>
              </Field>
              <Field className="lg:col-span-2">
                <FieldLabel htmlFor="vendor_id">Vendor</FieldLabel>
                <Select value={form.vendor_id || NO_VENDOR} onValueChange={chooseVendor}>
                  <SelectTrigger id="vendor_id" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_VENDOR}>No vendor</SelectItem>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>Optional. Add vendors you pay often under Vendors.</FieldDescription>
              </Field>
              <Field data-invalid={!!err("description")} className="sm:col-span-2 lg:col-span-3">
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Input id="description" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="e.g. AWS hosting, October" aria-invalid={!!err("description")} />
                <FieldError>{err("description")}</FieldError>
              </Field>
              <Field data-invalid={!!err("vendor_invoice_number")}>
                <FieldLabel htmlFor="vendor_invoice_number">Vendor bill no.</FieldLabel>
                <Input id="vendor_invoice_number" value={form.vendor_invoice_number} onChange={(e) => set("vendor_invoice_number", e.target.value)} placeholder="Optional" />
                <FieldError>{err("vendor_invoice_number")}</FieldError>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Amount</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field data-invalid={!!err("amount")}>
                <FieldLabel htmlFor="amount">Bill total (₹)</FieldLabel>
                <Input id="amount" value={form.amount} onChange={(e) => set("amount", e.target.value)} inputMode="decimal" placeholder="0.00" className="tabular-nums" aria-invalid={!!err("amount")} />
                <FieldDescription>{gstRegistered ? "Including any GST on the bill." : "What the vendor charged."}</FieldDescription>
                <FieldError>{err("amount")}</FieldError>
              </Field>
              {gstRegistered && (
                <Field data-invalid={!!err("gst_amount")}>
                  <FieldLabel htmlFor="gst_amount">{form.reverse_charge ? "GST you pay (₹)" : "GST on the bill (₹)"}</FieldLabel>
                  <Input id="gst_amount" value={form.gst_amount} onChange={(e) => set("gst_amount", e.target.value)} inputMode="decimal" className="tabular-nums" aria-invalid={!!err("gst_amount")} />
                  <FieldDescription>
                    {form.reverse_charge ? "Usually 18% of the bill total, paid with your GST return." : "CGST + SGST or IGST, as printed on the bill."}
                  </FieldDescription>
                  <FieldError>{err("gst_amount")}</FieldError>
                </Field>
              )}
              <Field data-invalid={!!err("tds_amount")} className="sm:col-span-2">
                <FieldLabel htmlFor="tds_amount">TDS deducted (₹)</FieldLabel>
                <Input id="tds_amount" value={form.tds_amount} onChange={(e) => set("tds_amount", e.target.value)} inputMode="decimal" className="tabular-nums" aria-invalid={!!err("tds_amount")} />
                <FieldDescription>
                  {tds > 0n
                    ? `The vendor receives ${formatINR(scaled(form.amount) - tds)}. Deposit the ${formatINR(tds)} with the government by the 7th of next month.`
                    : "If you withheld income tax, e.g. 10% of professional fees (2% for technical services) once a vendor passes ₹50,000 in the year."}
                </FieldDescription>
                <FieldError>{err("tds_amount")}</FieldError>
              </Field>
            </FieldGroup>
            {hasGst && (
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field orientation="horizontal">
                  <Checkbox id="itc_eligible" checked={form.itc_eligible} onCheckedChange={(v) => set("itc_eligible", v === true)} />
                  <FieldContent>
                    <FieldLabel htmlFor="itc_eligible">Claim input tax credit</FieldLabel>
                    <FieldDescription>
                      Only with the vendor&apos;s tax invoice in your GSTIN that shows in GSTR-2B. Not for food, cars, club fees or personal use
                      (blocked).
                    </FieldDescription>
                  </FieldContent>
                </Field>
                <Field orientation="horizontal">
                  <Checkbox id="reverse_charge" checked={form.reverse_charge} onCheckedChange={(v) => set("reverse_charge", v === true)} />
                  <FieldContent>
                    <FieldLabel htmlFor="reverse_charge">Reverse charge</FieldLabel>
                    <FieldDescription>
                      The vendor charged no GST and you pay it yourself, e.g. foreign software (AWS, Google Workspace) or an advocate&apos;s fees.
                    </FieldDescription>
                  </FieldContent>
                </Field>
              </FieldGroup>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field>
                <FieldLabel htmlFor="method">Paid by</FieldLabel>
                <Select value={form.method} onValueChange={(v) => set("method", v as ExpenseInput["method"])}>
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
            <CardTitle>Bill / receipt</CardTitle>
            <CardDescription>The vendor&apos;s invoice, a receipt or a payment screenshot. JPG, PNG, WEBP or PDF, up to 5 MB each.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {receipts.map((r) => (
              <div key={r.id} className="flex items-center gap-3 text-sm">
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noreferrer" className="truncate hover:underline">
                    {r.file_name}
                  </a>
                ) : (
                  <span className="truncate">{r.file_name}</span>
                )}
                <span className="shrink-0 text-muted-foreground tabular-nums">{Math.ceil(r.size_bytes / 1024)} KB</span>
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
                aria-label="Bill or receipt file"
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
            <Link href={expense ? `/finance/expenses/${expense.id}` : "/finance/expenses"}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : expense ? "Save" : "Record expense"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
