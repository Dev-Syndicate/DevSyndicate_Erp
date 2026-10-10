"use client";

import { useState, useTransition } from "react";
import { FileOutput } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { convertQuotation, type ConvertInput } from "@/features/quotations/actions";
import { formatINR, paise, toScaled } from "@/lib/money";

type Line = { id: string; description: string; quantity: number };

const rupees = (p: bigint) => `${p / 100n}.${String(p % 100n).padStart(2, "0")}`;

const MODES = [
  { value: "full", label: "Full quotation", hint: "All lines at 100%." },
  { value: "percent", label: "Percentage", hint: "Each line at a share of its value, e.g. a 50% advance." },
  { value: "items", label: "Selected lines", hint: "Pick lines and quantities to bill now." },
  { value: "amount", label: "Specific amount", hint: "One line for the amount you enter, e.g. an advance. GST, if any, is added on top." },
] as const;

/** Creates a draft invoice from an accepted quotation (PRD §14). The draft opens for review before issuing. */
export function ConvertQuotationButton(props: { id: string; lines: Line[]; grandTotal: number; invoicedTotal: number; gst: boolean }) {
  const left = paise(props.grandTotal) - paise(props.invoicedTotal);
  // Once part is invoiced, billing "what's left" is the safe default; Full / Percentage would bill it again.
  const started = paise(props.invoicedTotal) > 0n;
  const [mode, setMode] = useState<ConvertInput["mode"]>(started ? "amount" : "full");
  const [percent, setPercent] = useState("50");
  // With GST the amount is before tax, so only prefill the remaining total when there is none.
  const [amount, setAmount] = useState(started && !props.gst && left > 0n ? rupees(left) : "");
  const billing = toScaled(amount, 2) ?? 0n; // live: what this invoice takes off the balance
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function submit() {
    const input: ConvertInput =
      mode === "full"
        ? { mode }
        : mode === "percent"
          ? { mode, percent }
          : mode === "amount"
            ? { mode, amount }
            : { mode, items: Object.entries(picked).map(([id, quantity]) => ({ id, quantity })) };
    startTransition(async () => {
      const result = await convertQuotation(props.id, input);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <FileOutput /> Convert to invoice
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert to invoice</DialogTitle>
          <DialogDescription>
            Creates a draft invoice you can review before issuing. Invoiced so far: {formatINR(props.invoicedTotal)} of{" "}
            {formatINR(props.grandTotal)}.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="convert-mode">Bill</FieldLabel>
            <Select value={mode} onValueChange={(v) => setMode(v as ConvertInput["mode"])}>
              <SelectTrigger id="convert-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>{MODES.find((m) => m.value === mode)?.hint}</FieldDescription>
            {started && (mode === "full" || mode === "percent") && (
              <FieldDescription className="text-destructive">
                {formatINR(props.invoicedTotal)} is already invoiced.{" "}
                {mode === "full" ? `Full quotation bills ${formatINR(props.grandTotal)} again.` : "A percentage is of the full quotation, not of what's left."}{" "}
                Use Specific amount for the remaining {formatINR(left)}.
              </FieldDescription>
            )}
          </Field>
          {mode === "percent" && (
            <Field>
              <FieldLabel htmlFor="convert-percent">Percentage</FieldLabel>
              <Input id="convert-percent" value={percent} onChange={(e) => setPercent(e.target.value)} inputMode="decimal" className="w-32 tabular-nums" />
            </Field>
          )}
          {mode === "amount" && (
            <Field>
              <FieldLabel htmlFor="convert-amount">Amount (₹)</FieldLabel>
              <Input id="convert-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="10000" className="w-40 tabular-nums" />
              <FieldDescription>
                Left to invoice: {formatINR(left)}
                {billing > 0n && <> → {formatINR(left - billing > 0n ? left - billing : 0n)} after this invoice</>}
                {props.gst && " (before GST)"}
              </FieldDescription>
              {billing > left && (
                <FieldDescription className="text-destructive">
                  {formatINR(billing - left)} more than what&apos;s left. Issuing it will need a reason.
                </FieldDescription>
              )}
            </Field>
          )}
          {mode === "items" &&
            props.lines.map((line) => {
              const checked = line.id in picked;
              return (
                <Field key={line.id} orientation="horizontal">
                  <Checkbox
                    id={`line-${line.id}`}
                    checked={checked}
                    onCheckedChange={(on) =>
                      setPicked((p) => {
                        const next = { ...p };
                        if (on) next[line.id] = String(line.quantity);
                        else delete next[line.id];
                        return next;
                      })
                    }
                  />
                  <FieldLabel htmlFor={`line-${line.id}`} className="flex-1 font-normal">
                    {line.description}
                  </FieldLabel>
                  <Input
                    aria-label={`Quantity for ${line.description}`}
                    value={picked[line.id] ?? String(line.quantity)}
                    onChange={(e) => setPicked((p) => ({ ...p, [line.id]: e.target.value }))}
                    disabled={!checked}
                    inputMode="decimal"
                    className="w-24 text-right tabular-nums"
                  />
                </Field>
              );
            })}
        </FieldGroup>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || (mode === "items" && Object.keys(picked).length === 0) || (mode === "amount" && !amount.trim())}>
            {pending ? "Creating…" : "Create draft invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
